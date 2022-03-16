import {EventEmitter} from "events";
import ws from "websocket";
import http from "http";
import net from "net";
import beson from "beson";
import TrimId from "./lib/trimid.js";
import {RPCErrResponse, RPCEvent, RPCRequest, RPCResponse} from "./types.js";



interface WSRPServerPrivates {
	http_server:http.Server;
	ws_server:ws.server;
	connections:Map<string, ws.connection>;
	callmap:{[name:string]:WSPRrocedure};
	
	MAX_FORMAT_ERRORS:number,
}
interface WSConnPrivates {
	id:string;
	server:WSRPServer;
	connect_time:number;
	error_counts: {
		invalid_format: number;
	},
	session: WSRPSConnection
}
interface WSRPServerInit {
	http_server?:http.Server;
	max_format_errors?: number;
};


export interface WSPRrocedure {(this:WSRPSConnection, ...args:any[]):any}



const _WSRPSConnection:WeakMap<WSRPSConnection, {
	ref_conn:ws.connection;
}> = new WeakMap();

export class WSRPSConnection {
	constructor(conn:ws.connection) {
		_WSRPSConnection.set(this, {
			ref_conn:conn
		});
	}

	get id():string {
		const ref = _WSRPSConnection.get(this)!.ref_conn;
		return _WSCONNPRofile.get(ref)!.id;
	}
	get connect_time():number {
		const ref = _WSRPSConnection.get(this)!.ref_conn;
		return _WSCONNPRofile.get(ref)!.connect_time;
	}
	get connected():boolean { return _WSRPSConnection.get(this)!.ref_conn.connected; }
	raw_send(data:string|Buffer|ArrayBuffer|Uint8Array):this {
		CLIENT_SEND_MSG(_WSRPSConnection.get(this)!.ref_conn, data);
		return this;
	}
	send(data:RPCResponse|RPCEvent, use_json:boolean=false):this {
		CLIENT_SEND_MSG(_WSRPSConnection.get(this)!.ref_conn, use_json, data);
		return this;
	}
	disconnect(code:number=1000, reason?:string) {
		if (code !== undefined && typeof code !== "number") {
			throw new TypeError("Param 'code' must be a number!");
		}
		if (reason !== undefined && typeof reason !== "string") {
			throw new TypeError("Param 'reason' must be a string!");
		}

		if ( this.connected ) {
			_WSRPSConnection.get(this)!.ref_conn.close(code, reason);
		}
	}
}





const DEFAULT_MAX_FORMAT_ERRORS = 5;
const _WSCONNPRofile:WeakMap<ws.connection, WSConnPrivates> = new WeakMap();
const _WSRPServer:WeakMap<WSRPServer, WSRPServerPrivates> = new WeakMap();



export class WSRPServer extends EventEmitter {
	constructor(options?:WSRPServerInit) {
		super();

		options = options||{};
		
		const init_options:WSRPServerInit = Object(options)===options?options:{};
		const http_server = init_options.http_server||http.createServer();
		const ws_server = new ws.server({httpServer:http_server, autoAcceptConnections:false});
		_WSRPServer.set(this, {
			http_server,
			ws_server,
			connections:new Map(),
			callmap:{},

			MAX_FORMAT_ERRORS: init_options.max_format_errors||DEFAULT_MAX_FORMAT_ERRORS
		});

		ws_server.on('request', CLIENT_REQUESTED.bind(this));
	}
	register(name:string, callback:WSPRrocedure):this {
		const {callmap} = _WSRPServer.get(this)!;
		if ( callmap[name] ) {
			throw new RangeError(`Procedure name '${name}' has been occupied!`);
		}

		callmap[name] = callback;
		return this;
	}
	deregister(name:string):this {
		const {callmap} = _WSRPServer.get(this)!;
		if ( callmap[name] ) {
			delete callmap[name];
		}
		
		return this;
	}


	on(event:'connected', callback:{(conn:WSRPSConnection):void}):this;
	on(event:string, callback:{(...args:any[]):void}):this;
	on(event:string, callback:{(...args:any[]):void}):this {
		return super.on(event, callback);
	}

	listen(port?: number, hostname?: string, backlog?: number):Promise<string>;
	listen(port?: number, hostname?: string): Promise<string>;
	listen(port?: number, backlog?: number): Promise<string>;
	listen(port?: number): Promise<string>;
	listen(path: string, backlog?: number): Promise<string>;
	listen(path: string): Promise<string>;
	listen(options:net.ListenOptions): Promise<string>;
	listen(handle: any, backlog?: number): Promise<string>;
	listen(handle: any): Promise<string>;
	listen(...args:any):Promise<string> {
		const {http_server} = _WSRPServer.get(this)!;
		return new Promise((resolve, reject)=>{
			http_server.once('error', reject);
			http_server.listen(...args, ()=>{
				const addr_info = http_server.address()!;
				if ( addr_info === null ) return resolve('');
				if ( typeof addr_info === "string" ) return resolve(addr_info);
				if ( addr_info.family === 'IPv6' ) return resolve(`[${addr_info.address}]:${addr_info.port}`);
				return resolve(`${addr_info.address}:${addr_info.port}`);
			});
		})
	}

	close():Promise<void> {
		const {http_server, ws_server} = _WSRPServer.get(this)!;
		return new Promise((resolve, reject)=>{
			ws_server.shutDown();
			http_server.close((err)=>err?reject(err):resolve());
		});
	}
}




function CLIENT_REQUESTED(this:WSRPServer, request:ws.request) {
	const {connections} = _WSRPServer.get(this)!;
	const conn = request.accept();
	const conn_id = TrimId.NEW.toString(32);
	const connect_time = Math.floor(Date.now()/1000);

	connections.set(conn_id, conn);
	
	const session_ctrl = new WSRPSConnection(conn);
	_WSCONNPRofile.set(conn, {
		id:conn_id,
		server:this,
		connect_time,
		error_counts: {
			invalid_format: 0
		},
		session: session_ctrl
	});

	conn.on('message', CLIENT_MESSAGE).on('close', CLIENT_CLOSED);
	this.emit('connected', session_ctrl);
}

function CLIENT_MESSAGE(this:ws.connection, message:ws.Message) {
	const {id:conn_id, server, error_counts, connect_time, session} = _WSCONNPRofile.get(this)!;
	const {callmap, MAX_FORMAT_ERRORS: MAX_ALLOWED_FORMAT_ERRORS} = _WSRPServer.get(server)!;


	let data:RPCRequest, use_json:boolean;
	if ( message.type === 'utf8' ) {
		data = JSON.parse(message.utf8Data);
		use_json = true;
	}
	else {
		data = beson.Deserialize(message.binaryData);
		use_json = false;
	}



	if ( typeof data.id !== "string" || typeof data.method !== "string" || !Array.isArray(data.params) ) {
		const counts = error_counts.invalid_format++;
		if ( counts > MAX_ALLOWED_FORMAT_ERRORS ) {
			this.close(1008, 'too-many-invalid-requests');
		}
		else {
			console.error(`Receiving invalid request payload from remote client ${conn_id}!`);
		}
		return;
	}

	
	data.id	= data.id.trim();
	data.method = data.method.trim();
	if ( !data.method ) {
		const counts = error_counts.invalid_format++;
		if ( counts > MAX_ALLOWED_FORMAT_ERRORS ) {
			this.close(1008, 'too-many-invalid-requests');
		}
		else {
			console.error(`Receiving invalid request payload fields from remote client ${conn_id}!`);
		}
		return;
	}



	const handler = callmap[data.method];
	if ( typeof handler !== "function" ) {
		const response:RPCErrResponse = {id:data.id, error: {
			code: 'error#invalid-method',
			message: "Requested method doesn't exist!",
			data: {method:data.method}
		}};

		CLIENT_SEND_MSG(this, use_json, response);
		return;
	}



	Promise.resolve()
	.then(()=>handler.call(session, ...data.params))
	.then((res:RPCRequest|(Error&{code?:string; data?:any}))=>{
		if ( res instanceof Error ) {
			CLIENT_SEND_MSG(this, use_json, {id:data.id, error:{
				code: res.code||'error#unkown-error',
				message: res.message,
				stack: res.stack,
				data: res.data
			}})
			return;
		}

		CLIENT_SEND_MSG(this, use_json, {id:data.id, result:res})
	})
	.catch((e:Error&{code?:string; data?:any})=>{
		if ( !(e instanceof Error) ) {
			console.error(`Catched none error rejection from client ${conn_id} (id:${data.id}, method:${data.method})!`, e);
			const new_error:Error&{data?:any} = new Error(`Catched none error rejection when executing method '${data.method}'!`);
			new_error.data = {error:e, method:data.method};
			
			e = new_error;
		}


		console.error(`Received unexpected error when executing procedure (id:${data.id}, method:${data.method})!`, e);
		CLIENT_SEND_MSG(this, use_json, {id:data.id, error: {
			code: e.code||'error#unkown-error',
			message: e.message,
			stack: e.stack,
			data: e.data
		}});
	});
}
function CLIENT_CLOSED(this:ws.connection, code:number, desc:string) {
	const {id:conn_id, server, session} = _WSCONNPRofile.get(this)!;
	const {connections} = _WSRPServer.get(server)!;
	connections.delete(conn_id);

	server.emit('disconnected', session, code, desc);
}

function CLIENT_SEND_MSG(conn:ws.connection, message:string|Buffer|ArrayBuffer|Uint8Array):void;
function CLIENT_SEND_MSG(conn:ws.connection, json:boolean, message:RPCResponse|RPCEvent):void;
function CLIENT_SEND_MSG(conn:ws.connection, arg2:boolean|string|Buffer|ArrayBuffer|Uint8Array, arg3?:RPCResponse|RPCEvent):void {
	if ( !conn.connected ) return;
	

	let sent_data:string|Buffer;
	if ( typeof arg2 === "string" ) {
		sent_data = arg2;
	}
	else 
	if ( Buffer.isBuffer(arg2) ) {
		sent_data = arg2;
	}
	else
	if ( arg2 instanceof ArrayBuffer ) {
		sent_data = Buffer.from(arg2);
	}
	else
	if ( arg2 instanceof Uint8Array ) {
		sent_data = Buffer.from(arg2.buffer);
	}
	else 
	if ( typeof arg2 === "boolean" ){
		if ( arg3 === undefined ) {
			throw new SyntaxError("Message payload is required!");
		}

		sent_data = arg2 ? JSON.stringify(arg3) : Buffer.from(beson.Serialize(arg3));
	}
	else {
		throw new SyntaxError("The second argument must be either a boolean, an ArrayBuffer, an Uint8Array or a Buffer");
	}


	
	if ( Buffer.isBuffer(sent_data) ) {
		conn.sendBytes(sent_data);
	}
	else {
		conn.sendUTF(sent_data);
	}
}