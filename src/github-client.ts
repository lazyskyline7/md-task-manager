import { Octokit } from '@octokit/rest';
import { logger } from './logger';

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

// Shared regex pattern for parsing GitHub URLs
export const GITHUB_PATH_PATTERN =
  /github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)/;

export interface GitHubFileInfo {
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
}

export const parseGitHubPath = (path: string): GitHubFileInfo => {
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
  try {
    const octokit = getOctokit();
    const { owner, repo, branch, filePath } = getGitHubFileInfo();

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
    const errorMsg =
      error instanceof Error ? error.message : JSON.stringify(error);
    logger.error('GitHub fetch error:', errorMsg);

    if (errorMsg.includes('404')) {
      throw new Error(
        'Tasks file not found. Make sure the file exists in the repository.',
      );
    }

    throw new Error(`Failed to fetch file from GitHub: ${errorMsg}`);
  }
};

export const saveFileContent = async (
  content: string,
  commitMessage: string,
  retries = 3,
): Promise<boolean> => {
  let attempt = 0;
  while (attempt < retries) {
    try {
      const octokit = getOctokit();
      const { owner, repo, branch, filePath } = getGitHubFileInfo();

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
          `GitHub conflict (409) detected on attempt ${attempt}. Retrying...`,
        );
        // Wait a bit before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        continue;
      }

      const errorMsg =
        error instanceof Error ? error.message : JSON.stringify(error);
      logger.error(`GitHub save error (Attempt ${attempt}):`, errorMsg);

      if (attempt >= retries) {
        throw new Error(
          `Failed to save file to GitHub after ${retries} attempts: ${errorMsg}`,
        );
      }
    }
  }
  return false;
};
