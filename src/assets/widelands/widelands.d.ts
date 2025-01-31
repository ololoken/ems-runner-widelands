import { Module } from '../../types/Module';

export = akhenaten;
declare function akhenaten(moduleArg?: Partial<Module>): Promise<Module>;
declare namespace akhenaten {
    export { akhenaten as default };
}
