import { Module, ModuleInitParams } from '../types/Module';

import mainScriptUrlOrBlob from '../assets/widelands/widelands.js?url'

import wasm from '../assets/widelands/widelands.wasm?url'

import widelands from '../assets/widelands/widelands';

export const ModuleInstance = ({ ENV, reportDownloadProgress, pushMessage, canvas }: ModuleInitParams) => {

  let module: Partial<Module>;

  return widelands(module = {
    mainScriptUrlOrBlob: `${mainScriptUrlOrBlob}?pthread-worker`,
    print: msg => module.printErr?.(msg),
    printErr: msg => pushMessage?.(msg),
    canvas,
    preInit: [() => { Object.assign(module?.ENV ?? {}, ENV) }],
    preRun: [],
    noInitialRun: true,

    onExit: code => console.log('exit code: '+code),
    locateFile: (path: string) => {
      if (path.endsWith('wasm')) return wasm;
      throw(`Unknown file[${path}] is requested by widelands module; known urls are: ${[wasm]}`);
    },
    setStatus: (status: string | {}) => {
      if (!status) return;
      if (typeof status === 'string') {
        pushMessage(status);
        const dlProgressRE = /(?<progress>\d+)\/(?<total>\d+)/ig;
        if (!dlProgressRE.test(status)) return;
        dlProgressRE.lastIndex = 0;
        const { groups: { progress, total } } = [...status.matchAll(dlProgressRE)][0] as unknown as { groups: { progress: number, total: number } };
        reportDownloadProgress?.(Math.round(progress / total * 100));
      }
    }
  });
}
