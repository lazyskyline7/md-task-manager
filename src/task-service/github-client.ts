import { Octokit } from '@octokit/rest';
import { logger } from '../logger.js';
import { getErrorLog } from '../utils.js';

// Singleton Octokit instance
let octokitInstance: Octokit | null = null;

export const getOctokit = (): Octokit => {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN is not configured');
  }

  if (!octokitInstance) {
    octokitInstance = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
  }

  return octokitInstance;
};

const GITHUB_PATH_PATTERN =
  /github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)/;

interface GitHubFileInfo {
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
}
const parseGitHubPath = (path: string): GitHubFileInfo => {
  const match = path.match(GITHUB_PATH_PATTERN);
  if (!match) {
    throw new Error(
      'GITHUB_PATH format is invalid. Expected format: https://github.com/owner/repo/blob/branch/path/to/file',
    );
  }

  const [, owner, repo, branch, filePath] = match;
  return {
    owner,
    repo,
    branch,
    filePath: decodeURIComponent(filePath),
  };
};

export const getGitHubFileInfo = (): GitHubFileInfo => {
  const path = process.env.GITHUB_PATH;
  if (!path) {
    throw new Error('GITHUB_PATH is not configured');
  }

  return parseGitHubPath(path);
};

export const fetchFileContent = async (): Promise<string> => {
  const { owner, repo, branch, filePath } = getGitHubFileInfo();
  try {
    const octokit = getOctokit();

    const res = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: branch,
    });

    if (Array.isArray(res.data) || res.data.type !== 'file') {
      throw new Error('Path is not a file');
    }

    const base64 = res.data.content.replace(/\n/g, '');
    const text = Buffer.from(base64, 'base64').toString('utf8');

    return text;
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((error as any)?.status === 404) {
      const notFoundErrorMsg =
        'Tasks file not found. Make sure the file exists in the repository.';
      logger.error(
        getErrorLog({
          userId: owner,
          op: 'FETCH_FILE',
          error: notFoundErrorMsg,
        }),
      );
      throw new Error(notFoundErrorMsg);
    }
    const errorMsg =
      error instanceof Error ? error.message : JSON.stringify(error);
    logger.error(
      getErrorLog({ userId: owner, op: 'FETCH_FILE', error: errorMsg }),
    );
    throw new Error(`Failed to fetch file from GitHub: ${errorMsg}`);
  }
};

export const saveFileContent = async (
  content: string,
  commitMessage: string,
  retries = 3,
): Promise<boolean> => {
  let attempt = 0;
  const { owner, repo, branch, filePath } = getGitHubFileInfo();
  while (attempt < retries) {
    try {
      const octokit = getOctokit();

      // Get current file SHA (required for update)
      const currentFile = await octokit.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: branch,
      });

      if (Array.isArray(currentFile.data) || currentFile.data.type !== 'file') {
        throw new Error('Path is not a file');
      }

      // Update file on GitHub
      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: filePath,
        message: commitMessage,
        content: Buffer.from(content).toString('base64'),
        sha: currentFile.data.sha,
        branch,
      });

      logger.info(`File saved to GitHub: ${filePath}`);
      return true;
    } catch (error) {
      attempt++;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isConflict = (error as any)?.status === 409;

      if (isConflict && attempt < retries) {
        logger.warn(
          getErrorLog({
            userId: owner,
            op: 'SAVE_FILE',
            error: `GitHub conflict (409) detected on attempt ${attempt}. Retrying...`,
          }),
        );
        // Wait a bit before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        continue;
      }

      const errorMsg =
        error instanceof Error ? error.message : JSON.stringify(error);
      logger.error(
        getErrorLog({
          userId: owner,
          op: 'SAVE_FILE',
          error: `GitHub save error (Attempt ${attempt}): ${errorMsg}`,
        }),
      );

      if (attempt >= retries) {
        logger.error(
          getErrorLog({
            userId: owner,
            op: 'SAVE_FILE',
            error: `Failed after ${retries} attempts: ${errorMsg}`,
          }),
        );
        throw new Error(
          `Failed to save file to GitHub after ${retries} attempts: ${errorMsg}`,
        );
      }
    }
  }
  return false;
};
