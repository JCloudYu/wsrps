"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WSRPServer = void 0;
var events_1 = require("events");
var websocket_1 = __importDefault(require("websocket"));
var http_1 = __importDefault(require("http"));
var beson_1 = __importDefault(require("beson"));
var trimid_js_1 = __importDefault(require("./lib/trimid.js"));
;
;
var DEFAULT_MAX_FORMAT_ERRORS = 5;
var _WSCONNPRofile = new WeakMap();
var _WSRPServer = new WeakMap();
var WSRPServer = /** @class */ (function (_super) {
    __extends(WSRPServer, _super);
    function WSRPServer(options) {
        var _this = _super.call(this) || this;
        options = options || {};
        var init_options = Object(options) === options ? options : {};
        var http_server = init_options.http_server || http_1.default.createServer();
        var ws_server = new websocket_1.default.server({ httpServer: http_server, autoAcceptConnections: false });
        _WSRPServer.set(_this, {
            http_server: http_server,
            ws_server: ws_server,
            connections: new Map(),
            callmap: {},
            MAX_FORMAT_ERRORS: init_options.max_format_errors || DEFAULT_MAX_FORMAT_ERRORS
        });
        ws_server.on('request', CLIENT_REQUESTED.bind(_this));
        return _this;
    }
    WSRPServer.prototype.register = function (name, callback) {
        var callmap = _WSRPServer.get(this).callmap;
        if (callmap[name]) {
            throw new RangeError("Procedure name '".concat(name, "' has been occupied!"));
        }
        callmap[name] = callback;
        return this;
    };
    WSRPServer.prototype.listen = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var http_server = _WSRPServer.get(this).http_server;
        return new Promise(function (resolve, reject) {
            http_server.once('error', reject);
            http_server.listen.apply(http_server, __spreadArray(__spreadArray([], args, false), [function () {
                    var addr_info = http_server.address();
                    console.log(addr_info);
                    if (addr_info === null)
                        return resolve('');
                    if (typeof addr_info === "string")
                        return resolve(addr_info);
                    if (addr_info.family === 'IPv6')
                        return resolve("[".concat(addr_info.address, "]:").concat(addr_info.port));
                    return resolve("".concat(addr_info.address, ":").concat(addr_info.port));
                }], false));
        });
    };
    return WSRPServer;
}(events_1.EventEmitter));
exports.WSRPServer = WSRPServer;
function CLIENT_REQUESTED(request) {
    var connections = _WSRPServer.get(this).connections;
    var conn = request.accept();
    var conn_id = trimid_js_1.default.NEW.toString(32);
    connections.set(conn_id, conn);
    _WSCONNPRofile.set(conn, {
        id: conn_id,
        server: this,
        connect_time: Math.floor(Date.now() / 1000),
        error_counts: {
            invalid_format: 0
        }
    });
    conn.on('message', CLIENT_MESSAGE).on('close', CLIENT_CLOSED);
    console.log("Client ".concat(conn_id, " has connected!"));
}
function CLIENT_MESSAGE(message) {
    var _this = this;
    var _a = _WSCONNPRofile.get(this), conn_id = _a.id, server = _a.server, error_counts = _a.error_counts, connect_time = _a.connect_time;
    var _b = _WSRPServer.get(server), callmap = _b.callmap, MAX_ALLOWED_FORMAT_ERRORS = _b.MAX_FORMAT_ERRORS;
    var data, use_json;
    if (message.type === 'utf8') {
        data = JSON.parse(message.utf8Data);
        use_json = true;
    }
    else {
        data = beson_1.default.Deserialize(message.binaryData);
        use_json = false;
    }
    if (typeof data.id !== "string" || typeof data.method !== "string" || !Array.isArray(data.params)) {
        var counts = error_counts.invalid_format++;
        if (counts > MAX_ALLOWED_FORMAT_ERRORS) {
            this.close(1008, 'too-many-invalid-requests');
        }
        else {
            console.error("Receiving invalid request payload from remote client ".concat(conn_id, "!"));
        }
        return;
    }
    data.id = data.id.trim();
    data.method = data.method.trim();
    if (!data.method) {
        var counts = error_counts.invalid_format++;
        if (counts > MAX_ALLOWED_FORMAT_ERRORS) {
            this.close(1008, 'too-many-invalid-requests');
        }
        else {
            console.error("Receiving invalid request payload fields from remote client ".concat(conn_id, "!"));
        }
        return;
    }
    var handler = callmap[data.method];
    if (typeof handler !== "function") {
        var response = { id: data.id, error: {
                code: 'error#invalid-method',
                message: "Requested method doesn't exist!",
                data: { method: data.method }
            } };
        CLIENT_SEND_MSG(this, use_json, response);
        return;
    }
    var close_info = null;
    var conn_ctrl = {
        id: conn_id,
        disconnect: function (code, reason) {
            if (code === void 0) { code = 1000; }
            if (reason === void 0) { reason = undefined; }
            if (code !== undefined && typeof code !== "number") {
                throw new TypeError("Param 'code' must be a number!");
            }
            if (reason !== undefined && typeof reason !== "string") {
                throw new TypeError("Param 'reason' must be a string!");
            }
            close_info = { code: code, reason: reason };
        },
        connect_time: connect_time
    };
    Promise.resolve()
        .then(function () { return handler.call.apply(handler, __spreadArray([conn_ctrl], data.params, false)); })
        .then(function (res) { return CLIENT_SEND_MSG(_this, use_json, { id: data.id, result: res }); })
        .catch(function (e) {
        if (!(e instanceof Error)) {
            console.error("Catched none error rejection from client ".concat(conn_id, " (id:").concat(data.id, ", method:").concat(data.method, ")!"), e);
            var new_error = new Error("Catched none error rejection when executing method '".concat(data.method, "'!"));
            new_error.data = { error: e, method: data.method };
            e = new_error;
        }
        console.error("Received unexpected error when");
        CLIENT_SEND_MSG(_this, use_json, { id: data.id, error: {
                code: e.code || 'error#unkown-error',
                message: e.message,
                stack: e.stack,
                data: e.data
            } });
    })
        .finally(function () {
        if (close_info === null)
            return;
        _this.close(close_info.code, close_info.reason);
    });
}
function CLIENT_CLOSED(code, desc) {
    var _a = _WSCONNPRofile.get(this), conn_id = _a.id, server = _a.server;
    var connections = _WSRPServer.get(server).connections;
    connections.delete(conn_id);
    console.log("Client ".concat(conn_id, " has disconnected with (code:").concat(code, ", desc:").concat(desc, ")!"));
}
function CLIENT_SEND_MSG(conn, json, message) {
    if (json) {
        conn.sendUTF(JSON.stringify(message));
    }
    else {
        conn.sendBytes(Buffer.from(beson_1.default.Serialize(message)));
    }
}
