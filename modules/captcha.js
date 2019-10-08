var API_KEY = ""; // 2captcha API key
var proxifyRequest = require("./proxy").proxify;

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
async function getRecaptchaSolution(GOOGLE_KEY) {
	try {
		console.log("GOOGLE_KEY",GOOGLE_KEY);
		var res = await proxifyRequest({
			url: `https://2captcha.com/in.php?key=${API_KEY}&method=userrecaptcha&googlekey=${GOOGLE_KEY}&pageurl=https://store.steampowered.com/join/&header_acao=1&soft_id=2370&json=1`
		}).catch(function(err) {
			console.log(err);
			throw new Error("2Captcha sent invalid or empty json!");
		})
		if (res.body) res = res.body;
		if (!res.request) throw new Error("2Captcha sent invalid json!");
		console.log("2captcha requestid: " + res.request);
		let tries = 0;
		let getResult = async () => {
			await sleep(5 * 1000);
			var result = await proxifyRequest({
				url: `https://2captcha.com/res.php?key=${API_KEY}&action=get&id=${res.request}&json=1&header_acao=1`
			})
			if (result.body) result = result.body;
			tries += 1;
			if (result.status != 1) {
				if ((result.request == "CAPCHA_NOT_READY") & (tries < 25)) {
					console.log(result.request, "retrying in 5s");
					return await getResult();
				} else {
					return 0;
				}
			} else {
				return result.request
			}
		}
		var CaptchaResult = await getResult();
		console.log("CaptchaResult", CaptchaResult);
		return CaptchaResult;
	} catch (err) {
		console.log("err", err);
	}
}
module.exports = getRecaptchaSolution;