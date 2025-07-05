import { WebSocketServer, RawData } from 'ws';
import { Socket } from 'net';
import { createSocket } from 'dgram';

const wss = new WebSocketServer({ port: 4990 });

wss.on('connection', (ws, req) => {

  ws.on('error', console.error);

  const rqUrl = new URL(req.url ?? '', 'ws://proxy');
  const addr = rqUrl.searchParams.get('addr');
  const port = parseInt(rqUrl.searchParams.get('port') ?? '0');
  const type = parseInt(rqUrl.searchParams.get('type') ?? '0');

  if (!addr || !port || !type) {
    console.warn(`no proxy params provided: url[${req.url}], addr[${addr}], port[${port}], type[${type}]`);
    return;
  }
  console.log(`connecting to url[${req.url}], addr[${addr}], port[${port}], type[${type}]`);

  const msg_send_queue: Array<Uint8Array | string> = [];
  const msg_send_queue_callback = (data: RawData, isBinary: boolean) => {
    msg_send_queue.push(<typeof  msg_send_queue[0]>data)
  }

  if (type === 1) {

    const proxy = new Socket();
    let closing = false;

    ws.on('error', err => {
      console.error(err);
      console.log('terminating ws connection');
      ws.close();
    })
    ws.on('message', msg_send_queue_callback);
    ws.on('close', () => {
      console.info('websocket close event')
      if (!closing && !proxy.closed) {
        console.info('closing proxy')
        closing = true;
        proxy.end()
      }
    });

    proxy.on('connect', () => {
      ws.off('message', msg_send_queue_callback);
      do {
        const payload = msg_send_queue.shift();
        if (!payload) continue;
        if (!proxy.closed && !closing) proxy.write(payload);
      } while (msg_send_queue.length > 0)
      ws.on('message', (data, isBinary) => {
        if (!isBinary || !(data instanceof Buffer)) return;
        if (!proxy.closed && !closing) proxy.write(data);
      })
    });
    proxy.on('data', data => ws.send(data));
    proxy.on('close', () => {
      console.info('closed remote connection')
      ws.close();
    })

    proxy.on('error', err => {
      console.error(err);
      console.info('terminating proxy connection')
      ws.close();
    })

    proxy.connect({ port, host: addr });
  }
  else if (type === 2) {

    const udpProxy = createSocket('udp4');

    ws.on('message', msg_send_queue_callback);
    ws.on('close', () => udpProxy.close());

    udpProxy.on('connect', () => {
      ws.off('message', msg_send_queue_callback);
      do {
        const payload = msg_send_queue.shift();
        if (!payload) continue;
        udpProxy.send(payload);
      } while (msg_send_queue.length > 0)
      ws.on('message', (data, isBinary) => {
        if (!isBinary || !(data instanceof Buffer)) return;
        udpProxy.send(data);
      })
    });
    udpProxy.on('message', data => ws.send(data));
    udpProxy.on('close', () => ws.close());

    udpProxy.connect(port, addr);
  }

});
