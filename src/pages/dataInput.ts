import throwExpression from '../common/throwExpression';
import { Module } from '../types/Module';
import { BlobReader, Entry, Uint8ArrayWriter, ZipReader } from '@zip.js/zip.js';
import serial from '../common/serial';


const filterInput = (relativePath: string) => {
  if (relativePath.endsWith('/')) return false;
  const [fileName] = relativePath.split('/').reverse();
  return !(fileName.length === 0 || fileName.startsWith('.'));
}

const mkdirWithParents = (instance: Module) => (path: string) => {
  const parts = path.split('/');
  try { instance?.FS.lookupPath(parts.join('/')) }
  catch (ignore) {
    instance.print(`Creating new directory [${path}]`);
    parts.reduce((p, part) => {
      p = [...p, part];
      if (!part) return p;
      try { instance?.FS.lookupPath(p.join('/')) }
      catch (ignore) { instance?.FS.mkdir(p.join('/')) }
      return p;
    }, new Array<string>());
  }
}

const getUri = (basePath: string, entryName: string, hasRoot: boolean) => {
  const [fileName, ...path] = entryName.split('/').reverse();
  let relativePath: string[];
  if (hasRoot) [, ...relativePath] = path.reverse();
  else [...relativePath] = path.reverse();

  return [`${basePath}/${relativePath.join('/')}/${fileName}`, relativePath.join('/')];
}

export const zipHttpReader = async (instance: Module, url: string, chunkSize?: number) => {
  const response = await fetch(url);
  const contentLength = Number(response.headers.get('Content-Length'));
  instance.print(`Total download size ${(contentLength/1024/1024).toFixed()}MB`)
  const reader = response.body?.getReader() ?? throwExpression('no_stream');
  const chunks = new Array<Uint8Array<ArrayBufferLike>>();
  try {
    while(true) {
      const { done, value } = await reader.read();
      if (value) chunks.push(value);
      instance.print(`Caching ... ${(chunks.reduce((t, c) => t += c.length, 0) / 1024 / 1024).toFixed(2)}/${(contentLength / 1024 / 1024).toFixed(0)}MB`);
      if (done) break;
    }
  } finally {
    reader.releaseLock()
  }
  return new ZipReader(new BlobReader(new Blob(chunks))).getEntries({})
    .then(entries => entries.filter(({ filename: relativePath }) => filterInput(relativePath)))
    .then(async filtered => {
      const uploaded = <Array<boolean>>await serial(filtered
        .reduce((resultArray, item, index) => {
          const chunkIndex = Math.floor(index/(chunkSize ?? filtered.length))
          resultArray[chunkIndex] ??= new Array<Entry>
          resultArray[chunkIndex].push(item)
          return resultArray
        }, <Array<Array<Entry>>>[])
        .map(entries => () => Promise.all(entries.map(entry => {
          const [uri, relativePath] = getUri(`${instance.ENV.HOME}`, entry.filename, false);
          mkdirWithParents(instance)(`${instance.ENV.HOME}/${relativePath}`);
          return entry.getData?.(new Uint8ArrayWriter).then(data => {
            instance.print(`Writing file ${uri} to virtual fs from provided zip archive`);
            instance.FS.writeFile(`${uri}`, data, {
              encoding: 'binary'
            });
            return true;
          }).catch(e => {
            instance.print(`Failed to import ${uri}: ${e?.message ?? e ?? 'unknown exception'}`);
            return false;
          }) ?? Promise.resolve(false);
        }))));
      return !uploaded.some(r => !r) && uploaded.length === filtered.length;
    })
}
