//pm2 start server.js --name "Bot Creator" --interpreter node@8.12.0
var EmailReceiver = require("./modules/email").mail;
var EventManager = require("./modules/email").events;
var request = require("request");
var getRecaptchaSolution = require("./modules/captcha");
var EventEmitter = require('events').EventEmitter;
var proxifyRequest = require("./modules/proxy").proxify;
var loginGenerator = require("./modules/generator");
var puppeteer = require('puppeteer');
var SteamUser = require("steam-user");
var SteamStore = require("steamstore");
var GoogleSpreadsheet = require('google-spreadsheet');
var relay = require("./modules/relay.js");
relay = new relay("botCreator");
var timer = function(name) {
    var start = new Date();
    return {
        stop: function() {
            var end = new Date();
            var time = end.getTime() - start.getTime();
            return time;
        }
    }
};
var getError = (errCode) => {
    switch (errCode) {
        case 13:
            return {
                error: 'Email invalid',
                origin: "steam"
            };
        case 14:
            return {
                error: 'Account name invalid.',
                origin: "steam"
            };
        case 84:
            return {
                error: 'IP Limit or Email Limit',
                origin: "steam"
            };
        case 101:
            return {
                error: 'Captcha failed or IP banned',
                origin: "steam"
            };
        case 17:
            return {
                error: 'Email domain banned',
                origin: "steam"
            };
        case 1:
            return false;
        default:
            return {
                error: 'Error while creating the Steam account! Check console for details!',
                origin: "steam"
            };
    }
}
class Bot extends EventEmitter {
    constructor() {
        super();
        this.email = loginGenerator.mail();
        this.password = loginGenerator.password(Math.floor(Math.random() * (3 - 1) + 1));
        this.username = loginGenerator.username();
        this.browser;
        this.page;
        this.recaptcha = {
            code: "",
            gid: "",
            sitekey: ""
        };
        this.proxy = "";
        this.benchmark = timer("Benchmark_Bot" + this.username);
        console.log(this.email, this.username, this.password);
        relay.send({
            event: "getproxy",
            data: "rotating"
        })
        relay.once("receiveproxy", (proxy) => {
            this.proxy = proxy;
            console.log("got proxy", proxy);
            this.start();
        });
    }
    async failed(errCode) {
        if (!this.failedYet) {
            this.failedYet = true;
            console.log("failed", this.username, errCode);
            if (this.browser) {
                await this.browser.close();
            }
            EventManager.emit("Bot:Failed", this.username, errCode);
        }
    }
    async start() {
        try {
            if (this.proxy.indexOf("@") > -1) {
                this.auth = this.proxy.split("@")[0];
                this.proxy = this.proxy.split("@")[1];
            }
            this.browser = await puppeteer.launch({
                headless: true,
                ignoreHTTPSErrors: false,
                args: ['--proxy-server=' + this.proxy, '--ignore-certificate-errors', '--enable-feature=NetworkService']
            });
            this.page = await this.browser.newPage();
            if (this.auth) {
                await this.page.authenticate({
                    username: this.auth.split(":")[0],
                    password: this.auth.split(":")[1]
                });
            }
            this.page.on('requestfailed', interceptedRequest => {
                console.log("Request failed")
                this.failed();
            });
            await this.page.goto('https://store.steampowered.com/join/?l=english', {
                timeout: 50000
            }).catch(e => {
                console.log("catch", e);
                this.failed(e);
            })
            this.getData();
            this.emit("Bot:onCreationStart", this.username)
            this.page.on("error", (err) => {
                console.log(err);
                this.failed(err);
            })
            this.browser.on("disconnected", (err) => {
                console.log("disconnected", err);
            })
        } catch (err) {
            this.failed(err);
        }
    }
    async getData() {
        var PageData = await this.page.evaluate(() => {
            return new Promise((resolve, reject) => {
                window.oldUpdate = window.UpdateCaptcha;
                var gid = -1;
                var sitekey = -1;
                window.UpdateCaptcha = function(data) {
                    console.log("pUpdateCaptcha trigger", data);
                    sitekey = data.sitekey;
                    gid = data.gid;
                    window.oldUpdate(data);
                    return resolve({
                        sitekey: sitekey,
                        gid: gid
                    })
                }
            });
        });
        this.recaptcha.sitekey = PageData.sitekey;
        this.recaptcha.gid = PageData.gid;
        this.solveRecaptcha();
        this.emit("Bot:onRecaptchaReceive", this.username)
    }
    async solveRecaptcha(siteKey) {
        this.recaptcha.code = await getRecaptchaSolution(this.recaptcha.sitekey);
        if (this.recaptcha.code) {
            this.emit("Bot:onRecaptchaSolve", this.username)
            this.appendEmail();
        } else {
            this.emit("Bot:onRecaptchaError", this.username)
            this.failed();
        }
        console.log('recaptcha_captcha_text :', this.recaptcha.code);
    }
    async appendEmail() {
        var appendStatus = await this.page.evaluate(async (email, gid, recaptcha_solution) => {
            return new Promise((resolve) => {
                timed = setTimeout(() => {
                    return resolve(0);
                }, 10000);
                $J.ajax({
                    type: 'POST',
                    url: g_sBaseURL + 'join/ajaxverifyemail',
                    data: {
                        'email': email,
                        'captchagid': gid,
                        'captcha_text': recaptcha_solution
                    }
                }).done(function(data) {
                    if (data.success != 1) {
                        var strError = data.details;
                        if (data.success == 14) {
                            strError = 'The account name you have chosen is not available. Please choose another name.';
                        } else if (data.success == 8) {
                            strError = 'Please enter an account name that is at least 3 characters long and uses only a-z, A-Z, 0-9 or _ characters.';
                        } else if (data.success == 13) {
                            strError = 'Please enter a valid email address.';
                        } else if (data.success == 17) {
                            strError = 'It appears you\'ve entered a disposable email address, or are using an email provider that cannot be used on Steam. Please provide a different email address.';
                        } else if (data.success == 101) {
                            new Effect.Morph('captcha_text', {
                                style: 'border-color: #FF9900',
                                duration: 0.5
                            });
                        }
                        ShowError(strError);
                        return resolve(data.success)
                    } else {
                        g_creationSessionID = data.sessionid;
                        WaitForEmailVerification();
                        return resolve(data.success)
                    }
                }).fail((err, textStatus) => {
                    return reject("AJAX");
                })
            });
        }, this.email, this.recaptcha.gid, this.recaptcha.code);
        console.log('Mail Status:', appendStatus);
        if (!getError(appendStatus)) {
            this.fetchMail();
        } else {
            this.failed(appendStatus)
        }
    }
    async appendLogin() {
        this.page.once('load', async () => {
            console.log("page reload", this.page.url());
            if (this.page.url().indexOf("completesignup?l=english&creationid=") > -1) {
                var signUpState = await this.page.evaluate(async (username, password) => {
                    return new Promise((resolve) => {
                        timed = setTimeout(() => {
                            return resolve(0);
                        }, 10000);
                        ++iAjaxCalls;
                        new Ajax.Request(g_sBaseURL + 'join/createaccount/', {
                            type: 'POST',
                            parameters: {
                                accountname: username,
                                password: password,
                                count: iAjaxCalls,
                                lt: $('lt').value,
                                creation_sessionid: g_creationSessionID,
                                embedded_appid: g_embeddedAppID,
                            },
                            onSuccess: function(transport) {
                                var bSuccess = false;
                                if (transport.responseText) {
                                    try {
                                        var result = transport.responseText.evalJSON(true);
                                    } catch (e) {}
                                    if (result && result.bSuccess) bSuccess = true;
                                }
                                if (!bSuccess) {
                                    ShowError(result.details ? result.details : 'Your account creation request failed, please try again later.');
                                    resolve(result);
                                } else if (bSuccess) {
                                    resolve(true);
                                } else {
                                    resolve(result);
                                }
                            },
                            onFailure: function() {
                                ShowError('Your account creation request failed, please try again later.');
                                resolve("fail ajax");
                            }
                        });
                    });
                }, this.username, this.password);
                if (signUpState != true) {
                    console.log("failed creating", signUpState);
                    this.failed(signUpState)
                } else {
                    console.log("created account", signUpState, this.username, this.password);
                    this.clientStart();
                }
            } else {
                this.failed("Invalid URL after append");
            }
        })
    }
    async handleMail(mail) {
        let link = mail.link;
        let proxy = (this.auth != undefined) ? this.auth + "@" + this.proxy : this.proxy;
        var result = await proxifyRequest({
            url: link
        }, null, proxy)
        if (result.status == 200) {
            this.appendLogin();
        }
    }
    async fetchMail() {
        console.log("fetching mail...");
        EventManager.on('Mail:New', this.mailfunc = (mail) => {
            if (mail.to.toString().toLowerCase() == this.email.toString().toLowerCase()) {
                console.log("- Got email for account creation...");
                EventManager.removeListener("Mail:New", this.mailfunc);
                if (this.timeout) {
                    clearTimeout(this.timeout);
                }
                this.handleMail(mail);
            }
        });
        this.timeout = setTimeout(() => {
            EventManager.removeListener("Mail:New", this.mailfunc);
            this.failed("No email");
        }, 120 * 1000)
    }
    async clientStart() {
        console.log("Steam client start");
        let proxy = (this.auth != undefined) ? this.auth + "@" + this.proxy : this.proxy;
        this.steamUser = new SteamUser();
        this.steamUser.setOption("httpProxy", "http://" + proxy);
        this.steamStore = new SteamStore();
        this.steamUser.on('webSession', (sessionID, cookies) => {
            console.log("Got webSession");
            if (this.steamStore) {
                this.steamStore.setCookies(cookies);
                this.steamStore.addFreeLicense(303386, (err) => {
                    if (err) this.failed("failed adding csgo");
                    this.clientFinish();
                })
            }
        });
        this.steamUser.logOn({
            "accountName": this.username,
            "password": this.password
        });
    }
    async removeSteamGuard() {
        console.log("removing steamguard...");
        await this.page.goto('https://store.steampowered.com/twofactor/manage', {
            timeout: 50000
        }).catch(e => {
            console.log("catch", e);
            this.failed(e);
        })
        console.log("steamguard page loaded...");
        await this.page.evaluate(async () => {
            $J("#none_authenticator_form").submit()
        });
        this.page.once('load', async () => {
            if (this.page.url().indexOf("twofactor/manage_action") > -1) {
                await this.page.evaluate(async () => {
                    document.getElementById('none_authenticator_form').submit();
                }).catch(e => {
                    console.log("catch", e);
                    this.failed(e);
                })
                console.log("steamgurad waiting for confirmation...");
                this.page.once('load', async () => {
                    if (this.page.url().indexOf("twofactor/manage_action") > -1) {
                        this.steamGuardFinish();
                    }
                });
            }
        });
    }
    async steamGuardFinish() {
        console.log("steamguard removed");
        await this.browser.close();
        let time = this.benchmark.stop();
        console.log("creation took", time / 1000, "s");
        EventManager.emit('Bot:Finish', this.username, this.password, this.email);
        this.emit('Bot:Finish', this.username, this.password, this.email);
    }
    async clientFinish() {
        console.log("added csgo");
        this.removeSteamGuard();
    }
}
var cBot;
EventManager.on('Mail:Init', () => {
    console.log("MailReceiver init");
    console.log("START BOT NEW");
    cBot = new Bot();
});
EventManager.on("Bot:Failed", (username, errCode) => {
    console.log("Bot:Failed", username, errCode);
    delete cBot;
    console.log("START BOT NEW1");
    setTimeout(() => {
        cBot = new Bot()
    }, 20 * 1000);
});
EventManager.on("Bot:Finish", (username, password, email) => {
    console.log("account finished", username, password, email);
    setTimeout(() => {
        delete cBot;
        console.log("START BOT NEW2");
        cBot = new Bot()
    }, 2 * 20 * 1000);
})