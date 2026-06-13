import { spawnSync } from 'node:child_process';

const checkovVersion = process.env.CHECKOV_VERSION ?? '3.3.1';
const checkovArgs = [
  '--directory',
  '.checkov/cfn',
  '--framework',
  'cloudformation',
  '--quiet',
  '--compact',
];

const run = (command, args) => {
  return spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
  });
};

const candidates = [
  {
    command: 'checkov',
    args: checkovArgs,
  },
  {
    command: 'uvx',
    args: ['--from', `checkov==${checkovVersion}`, 'checkov', ...checkovArgs],
  },
];

for (const candidate of candidates) {
  const result = run(candidate.command, candidate.args);

  if (result.error?.code === 'ENOENT') {
    continue;
  }

  process.exit(result.status ?? 1);
}

console.error(
  `Checkov is not available. Install checkov==${checkovVersion} or install uvx so npm run security:checkov can run the pinned Checkov version.`,
);
process.exit(1);
