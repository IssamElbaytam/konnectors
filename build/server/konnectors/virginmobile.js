// Generated by CoffeeScript 1.10.0
var Bill, cozydb, fetcher, filterExisting, linkBankOperation, localization, log, logIn, moment, parsePage, request, requestJSON, saveDataAndFile;

cozydb = require('cozydb');

request = require('request');

requestJSON = require('request-json');

moment = require('moment');

fetcher = require('../lib/fetcher');

filterExisting = require('../lib/filter_existing');

saveDataAndFile = require('../lib/save_data_and_file');

linkBankOperation = require('../lib/link_bank_operation');

localization = require('../lib/localization_manager');

log = require('printit')({
  prefix: "Virgin Mobile",
  date: true
});

Bill = require('../models/bill');

module.exports = {
  name: "Virgin Mobile",
  slug: "virginmobile",
  description: 'konnector description virginmobile',
  vendorLink: "https://www.virginmobile.fr/",
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
    return fetcher["new"]().use(logIn).use(parsePage).use(filterExisting(log, Bill)).use(saveDataAndFile(log, Bill, 'virgin mobile', ['bill'])).use(linkBankOperation({
      log: log,
      model: Bill,
      identifier: 'virgin mobile',
      dateDelta: 17,
      amountDelta: 5
    })).args(requiredFields, {}, {}).fetch(function(err, fields, entries) {
      var localizationKey, notifContent, options, ref;
      log.info("Import finished");
      notifContent = null;
      if ((entries != null ? (ref = entries.filtered) != null ? ref.length : void 0 : void 0) > 0) {
        localizationKey = 'notification virginmobile';
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
  var client, signInOptions;
  signInOptions = {
    method: 'POST',
    jar: true,
    url: "https://espaceclient.virginmobile.fr/login_check",
    form: {
      'login': requiredFields.login,
      'password': requiredFields.password,
      '_target_path': "factures-echeances"
    }
  };
  client = requestJSON.newClient("https://espaceclient.virginmobile.fr/");
  log.info('Signing in');
  return request(signInOptions, function(err, res, body) {
    if (err) {
      log.error("Signin failed");
      return next('bad credentials');
    }
    client.headers["Cookie"] = res.headers["set-cookie"];
    log.info('Fetching bills list');
    return client.get("api/getFacturesData", function(err, res, body) {
      if (err || !body.success) {
        log.error('An error occured while fetching bills list');
        return next("no bills retrieved");
      }
      data.content = body.data;
      return next();
    });
  });
};

parsePage = function(requiredFields, bills, data, next) {
  var baseURL, bill, i, inv, invoices, len;
  bills.fetched = [];
  baseURL = "https://espaceclient.virginmobile.fr/api/getFacturePdf/";
  invoices = data.content.infoFacturation.invoices;
  for (i = 0, len = invoices.length; i < len; i++) {
    inv = invoices[i];
    if (inv.pdfDispo) {
      bill = {
        date: moment(inv.invoiceDate, 'DD/MM/YYYY'),
        amount: parseFloat(inv.amount.unite + '.' + inv.amount.centimes),
        pdfurl: baseURL + inv.invoiceNumber,
        type: "phone",
        vendor: "Virgin mobile"
      };
      if ((bill.date != null) && (bill.amount != null) && (bill.pdfurl != null)) {
        bills.fetched.push(bill);
      }
    }
  }
  log.info("Bill retrieved: " + bills.fetched.length + " found");
  return next();
};
