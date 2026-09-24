import { runStudy } from '../skill-pilot/run.ts';
runStudy(2700, 5).catch(e => { console.error(e.message); process.exitCode = 1; });
