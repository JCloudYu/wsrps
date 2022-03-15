type epoch = number;
export interface RPCRequest {
	id?: string;
	method: string;
	params: any[];
};
export interface RPCSuccResponse {
	id?: string;
	result?: any;
};
export interface RPCErrResponse {
	id?: string;
	error: {
		code: string;
		message: string;
		stack?: string;
		data?: any;
	};
};
export type RPCResponse = RPCSuccResponse|RPCErrResponse;
export interface RPCEvent {
	id?: string;
	event: string;
	data: any;
	time: epoch;
};