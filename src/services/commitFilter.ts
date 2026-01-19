import { GitHubCommit } from '../types.js';

const BOT_COMMIT_MESSAGE_PATTERNS = [
  /^\[bot\] Update tasks -/,
  /^\[bot\] Initialize tasks file$/,
];

export const isExternalCommit = (commit: GitHubCommit): boolean => {
  const message = commit.message;

  for (const pattern of BOT_COMMIT_MESSAGE_PATTERNS) {
    if (pattern.test(message)) {
      return false;
    }
  }

  return true;
};

export const filterExternalCommits = (
  commits: GitHubCommit[],
): GitHubCommit[] => commits.filter(isExternalCommit);
