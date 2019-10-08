var request = require("request");
var proxyAgent = require('proxy-agent');
var url = require("url");
var isJSON = function(text) {
	try {
		JSON.parse(text);
		return true;
	} catch (error) {
		return false;
	}
}


async function httpRequest(options, cookies, proxyAddr) {
	let request_proxy = request.defaults({
		'proxy': proxyAddr
	});
	if (!options) options = {};
	if (!options.method) options.method = "GET";
	var agent = undefined;
	if (cookies != null) {
		options.jar = cookies;
	}
	options.timeout = 10 * 1000;
	options.headers = {
		'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:69.0) Gecko/20100101 Firefox/69.0"
	};
	return new Promise(async function(resolve, reject) {
		request(options, function(error, response, body) {
			if (error || (response.statusCode != 200)) {
				console.log(response.statusCode);
				console.log(error);
				return reject(error);
			} else {
				console.log("status", response.statusCode);
				if (isJSON(body)) body = JSON.parse(body);
				return resolve({
					body: body,
					status: response.statusCode
				});
			}
		});
	})
}
module.exports = {
	proxify: httpRequest
}