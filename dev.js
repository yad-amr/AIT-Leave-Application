const { spawn } = require('node:child_process');
const children = ['server', 'client'].map(folder => {
  const command = process.platform === 'win32' ? 'cmd.exe' : 'npm';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', `npm --prefix ${folder} run dev`]
    : ['--prefix', folder, 'run', 'dev'];
  return spawn(command, args, { stdio: 'inherit' });
});
function stop() { for (const child of children) child.kill('SIGTERM'); }
for (const child of children) child.on('exit', code => { stop(); process.exit(code || 0); });
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
