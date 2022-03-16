import ws from "websocket";
import TrimId from "../lib/trimid.js";
import beson from "beson";
import {WSRPServer} from "../index.js";
Promise.resolve().then(async()=>{
	let conn:any = null;
	const server = new WSRPServer();
	server.register('say_hi', function(...args:any) {
		console.log('say_hi', conn === this)
		return "Hi! " + JSON.stringify(args);
	})
	.register('bye', function() {
		console.log("bye", conn === this)
		this.disconnect();
		return "bye!"
	})
	.on('connected', (_conn)=>{
		conn = _conn;
		console.log("connected", _conn.id);
		_conn.send({
			event:'welcoming',
			data:'Welcome to this virtual world!',
			time:Math.floor(Date.now()/1000)
		})
	})
	.on('disconnected', (_conn)=>{
		console.log("disconnected", conn === _conn, _conn.id);
	});

	const conn_info = await server.listen(8880);
	console.log(conn_info);





	const client = new ws.client();
	client.connect("ws://localhost:8880");
	client.on('connect', (conn)=>{
		conn.on('message', (data)=>{
			if ( data.type === 'binary' ) {
				console.log(beson.Deserialize(data.binaryData));
			}
			else {
				console.log(JSON.parse(data.utf8Data));
			}
		});
		
		conn.sendUTF(JSON.stringify({id:TrimId.NEW.toString(32), method:"say_hi", params:[]}));
		conn.sendBytes(Buffer.from(beson.Serialize({id:TrimId.NEW.toString(32), method:"bye", params:[]})));
		conn.on('close', (...args)=>{
			console.log("Disconnected", args);
		});
	});

	setTimeout(()=>{
		console.log("Closing server...");
		server.close().then(()=>{console.log("Server closed!")})
	}, 3000);
});