import { Telegraf } from 'telegraf';
import { GitHubPushPayload, GitHubCommit } from '../core/types.js';
import { filterExternalCommits } from './commitFilter.js';
import { getOctokit, getGitHubFileInfo } from '../clients/github.js';
import { analyzeTaskDiff, hasChanges } from './diffAnalyzer.js';
import { formatGitHubSyncMessage } from '../messages/github-message.js';
import logger from '../core/logger.js';
import { ALLOWED_USERS } from '../core/config.js';

export const handleGitHubWebhook = async (
  payload: GitHubPushPayload,
  bot: Telegraf,
): Promise<void> => {
  // 1. Filter external commits
  const externalCommits = filterExternalCommits(payload.commits);

  if (externalCommits.length === 0) {
    logger.infoWithContext({
      op: 'GITHUB_WEBHOOK',
      message: 'No external commits found, skipping',
    });
    return;
  }

  // 2. Check if task file was modified in any of the external commits
  const { filePath, owner, repo } = getGitHubFileInfo();
  // filePath in GITHUB_PATH might be full path, but github webhook uses relative paths
  // We need to be careful with path matching.
  // Let's rely on finding the file in modified/added lists.

  const relevantCommits: GitHubCommit[] = [];

  for (const commit of externalCommits) {
    const isModified = commit.modified.some((file) => filePath.endsWith(file));
    const isAdded = commit.added.some((file) => filePath.endsWith(file));

    if (isModified || isAdded) {
      relevantCommits.push(commit);
    }
  }

  if (relevantCommits.length === 0) {
    logger.infoWithContext({
      op: 'GITHUB_WEBHOOK',
      message: 'Task file not modified in external commits, skipping',
    });
    return;
  }

  // 3. Process each relevant commit
  // We process from oldest to newest to show the progression
  const octokit = getOctokit();

  for (const commit of relevantCommits) {
    try {
      // Get file content at this commit
      const { data: currentFile } = await octokit.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: commit.id,
      });

      if (Array.isArray(currentFile) || currentFile.type !== 'file') {
        logger.warnWithContext({
          op: 'GITHUB_WEBHOOK',
          message: `Path is not a file at commit ${commit.id}`,
        });
        continue;
      }

      const currentContent = Buffer.from(
        currentFile.content,
        'base64',
      ).toString('utf8');

      // Get file content from parent commit (before this change)
      // We need to find the parent of this commit.
      // For simplicity in this iteration, we'll try to get the file content
      // from the commit before this one.
      // But calculating "before" is tricky if we don't have the parent SHA easily available in the payload.
      // The payload gives us "before" and "after" for the whole push, but not per commit.

      // Strategy: Get the commit details to find parent SHA
      const { data: commitDetails } = await octokit.repos.getCommit({
        owner,
        repo,
        ref: commit.id,
      });

      const parentSha = commitDetails.parents[0]?.sha;

      let previousContent = '';
      if (parentSha) {
        try {
          const { data: prevFile } = await octokit.repos.getContent({
            owner,
            repo,
            path: filePath,
            ref: parentSha,
          });

          if (!Array.isArray(prevFile) && prevFile.type === 'file') {
            previousContent = Buffer.from(prevFile.content, 'base64').toString(
              'utf8',
            );
          }
        } catch (error) {
          // File might not have existed in parent commit (newly created)
          logger.warnWithContext({
            op: 'GITHUB_WEBHOOK',
            message: `Could not fetch previous content for commit ${commit.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      }

      // 4. Analyze Diff
      const diff = analyzeTaskDiff(previousContent, currentContent);

      if (!hasChanges(diff)) {
        logger.infoWithContext({
          op: 'GITHUB_WEBHOOK',
          message: `No task changes detected in commit ${commit.id}`,
        });
        continue;
      }

      // 5. Send Notification
      const message = formatGitHubSyncMessage(diff, {
        sha: commit.id,
        message: commit.message,
        author: commit.author.name,
        url: commit.url,
      });

      // Send to the first allowed user (admin)
      if (ALLOWED_USERS.length > 0) {
        await bot.telegram.sendMessage(ALLOWED_USERS[0], message, {
          parse_mode: 'MarkdownV2',
          link_preview_options: { is_disabled: true },
        });

        logger.infoWithContext({
          op: 'GITHUB_WEBHOOK',
          message: `Notification sent for commit ${commit.id}`,
        });
      }
    } catch (error) {
      logger.errorWithContext({
        op: 'GITHUB_WEBHOOK',
        message: `Error processing commit ${commit.id}`,
        error,
      });
    }
  }
};
