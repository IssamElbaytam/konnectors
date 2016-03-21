// Generated by CoffeeScript 1.10.0
var Bill, cheerio, cozydb, fetcher, filterExisting, linkBankOperation, localization, log, logIn, moment, parsePage, request, saveDataAndFile;

cozydb = require('cozydb');

request = require('request');

moment = require('moment');

cheerio = require('cheerio');

fetcher = require('../lib/fetcher');

filterExisting = require('../lib/filter_existing');

saveDataAndFile = require('../lib/save_data_and_file');

linkBankOperation = require('../lib/link_bank_operation');

localization = require('../lib/localization_manager');

log = require('printit')({
  prefix: "numericable",
  date: true
});

Bill = require('../models/bill');

module.exports = {
  name: "Numéricable",
  slug: "numericable",
  description: 'konnector description numericable',
  vendorLink: "https://www.numericable.fr/",
  fields: {
    login: "text",
    password: "password",
    folderPath: "folder"
  },
  models: {
    bill: Bill
  },
  init: function(callback) {
    return callback();
  },
  fetch: function(requiredFields, callback) {
    log.info("Import started");
    return fetcher["new"]().use(logIn).use(parsePage).use(filterExisting(log, Bill)).use(saveDataAndFile(log, Bill, 'numericable', ['bill'])).use(linkBankOperation({
      log: log,
      model: Bill,
      identifier: 'numericable',
      dateDelta: 12
    })).args(requiredFields, {}, {}).fetch(function(err, fields, entries) {
      var localizationKey, notifContent, options, ref;
      log.info("Import finished");
      notifContent = "";
      if (err) {
        notifContent = "notification import error";
      }
      if ((entries != null ? (ref = entries.filtered) != null ? ref.length : void 0 : void 0) > 0) {
        localizationKey = 'notification numericable';
        options = {
          smart_count: entries.filtered.length
        };
        notifContent = localization.t(localizationKey, options);
      }
      return callback(err, notifContent);
    });
  }
};

logIn = function(requiredFields, billInfos, data, next) {
  var accountUrl, appKeyOptions, billOptions, connectionUrl, logInOptions, redirectOptions, signInOptions, tokenAuthOptions;
  accountUrl = "https://moncompte.numericable.fr";
  connectionUrl = "https://connexion.numericable.fr";
  appKeyOptions = {
    method: 'GET',
    jar: true,
    url: accountUrl + "/pages/connection/Login.aspx"
  };
  logInOptions = {
    method: 'POST',
    jar: true,
    url: connectionUrl + "/Oauth/Oauth.php",
    form: {
      'action': "connect",
      'linkSSO': connectionUrl + "/pages/connection/Login.aspx?link=HOME",
      'appkey': "",
      'isMobile': ""
    }
  };
  redirectOptions = {
    method: 'POST',
    jar: true,
    url: connectionUrl
  };
  signInOptions = {
    method: 'POST',
    jar: true,
    url: connectionUrl + "/Oauth/login/",
    form: {
      'login': requiredFields.login,
      'pwd': requiredFields.password
    }
  };
  tokenAuthOptions = {
    method: 'POST',
    jar: true,
    url: accountUrl + "/pages/connection/Login.aspx?link=HOME",
    qs: {
      accessToken: ""
    }
  };
  billOptions = {
    method: 'GET',
    jar: true,
    uri: accountUrl + "/pages/billing/Invoice.aspx"
  };
  log.info('Getting appkey');
  return request(appKeyOptions, function(err, res, body) {
    var $, appKey;
    appKey = "";
    if (!err) {
      $ = cheerio.load(body);
      appKey = $('#PostForm input[name="appkey"]').attr("value");
    }
    if (!appKey) {
      log.info("Numericable: could not retrieve app key");
      return next("key not found");
    }
    logInOptions.form.appkey = appKey;
    log.info('Logging in');
    return request(logInOptions, function(err, res, body) {
      if (err) {
        log.error('Login failed');
        return next("error occurred during import.");
      }
      log.info('Signing in');
      return request(signInOptions, function(err, res, body) {
        var redirectUrl;
        if (err) {
          log.error('Signin failed');
          return next("bad credentials");
        }
        redirectUrl = res.headers.location;
        if (!redirectUrl) {
          return next("Could not retrieve redirect URL");
        }
        redirectOptions.url += redirectUrl;
        log.info("Fetching access token");
        return request(redirectOptions, function(err, res, body) {
          var accessToken;
          accessToken = "";
          if (!err) {
            $ = cheerio.load(body);
            accessToken = $("#accessToken").attr("value");
          }
          if (!accessToken) {
            log.error('Token fetching failed');
            return next("error occurred during import.");
          }
          tokenAuthOptions.qs.accessToken = accessToken;
          log.info("Authenticating by token");
          return request(tokenAuthOptions, function(err, res, body) {
            if (err) {
              log.error('Authentication by token failed');
              return next("error occurred during import.");
            }
            log.info('Fetching bills page');
            return request(billOptions, function(err, res, body) {
              if (err) {
                log.error('An error occured while fetching ' + 'bills page');
                return next("no bills retrieved");
              }
              data.html = body;
              return next();
            });
          });
        });
      });
    });
  });
};

parsePage = function(requiredFields, bills, data, next) {
  var $, baseURL, bill, billDate, billLink, billTotal, firstBill;
  bills.fetched = [];
  $ = cheerio.load(data.html);
  baseURL = "https://moncompte.numericable.fr";
  log.info('Parsing bill page');
  firstBill = $("#firstFact");
  billDate = firstBill.find("h2 span");
  billTotal = firstBill.find('p.right');
  billLink = firstBill.find('a.linkBtn');
  bill = {
    date: moment(billDate.html(), 'DD/MM/YYYY'),
    amount: parseFloat(billTotal.html().replace(' €', '').replace(',', '.')),
    pdfurl: baseURL + billLink.attr("href"),
    type: 'internet',
    vendor: 'Numéricable'
  };
  if ((bill.date != null) && (bill.amount != null) && (bill.pdfurl != null)) {
    bills.fetched.push(bill);
  }
  $('#facture > div[id!="firstFact"]').each(function() {
    billDate = $(this).find('h3').html().substr(3);
    billTotal = $(this).find('p.right');
    billLink = $(this).find('a.linkBtn');
    bill = {
      date: moment(billDate, 'DD/MM/YYYY'),
      amount: parseFloat(billTotal.html().replace(' €', '').replace(',', '.')),
      pdfurl: baseURL + billLink.attr('href'),
      type: 'internet',
      vendor: 'Numéricable'
    };
    if ((bill.date != null) && (bill.amount != null) && (bill.pdfurl != null)) {
      return bills.fetched.push(bill);
    }
  });
  log.info(bills.fetched.length + " bill(s) retrieved");
  if (!bills.fetched.length) {
    return next("no bills retrieved");
  } else {
    return next();
  }
};
