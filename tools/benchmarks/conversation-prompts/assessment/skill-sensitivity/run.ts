import {runStudy} from '../skill-pilot/run.ts';
runStudy(900,2,true).catch(e=>{console.error(e.message);process.exitCode=1;});
