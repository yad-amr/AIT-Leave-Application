const { spawn } = require('node:child_process');
const children = ['server', 'client'].map(folder => spawn('npm', ['--prefix', folder, 'run', 'dev'], { stdio: 'inherit' }));
function stop() { for (const child of children) child.kill('SIGTERM'); }
for (const child of children) child.on('exit', code => { stop(); process.exit(code || 0); });
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
