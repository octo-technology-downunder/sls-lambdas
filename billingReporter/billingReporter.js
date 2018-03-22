"use strict";
const { promisify } = require( "es6-promisify" );
const csvParse = promisify( require( "csv-parse" ) );
const csvSettings = require( "./billingReporterSettings.json" ).csv;


module.exports = class BillingReport {

    processData(data) {
        return csvParse(data).then((parsedData) => {
            this._headersArray = parsedData.shift(1);
            this._dataArray = parsedData;
            return data;
        });
    }

    getGrandTotalAmount() {
        const amountColumnIndex = this._getAmountPosition();
        return this._dataArray.map(row => row[amountColumnIndex]).reduce((a, b) => {
            a = isNaN(a) ? 0 : parseFloat(a);
            b = isNaN(b) ? 0 : parseFloat(b);
            return a + b;
        });
    }

    getSingleServiceTotal(serviceName) {
        const totals = this._getTotalsByService();
        return totals.find(service => service.serviceName === serviceName);
    }

    getServicesToReport(limit) {
        const totals = this._getTotalsByService();
        if (!totals.sorted) {
            totals.sort((a, b) => {
                if (a.amount > b.amount) {
                    return -1;
                } else if (a.amount < b.amount) {
                    return 1;
                } else return 0;
            });
            totals.sorted = true;
        }
        const totalThreshold = this.getGrandTotalAmount() * limit;
        const limitedTotals = [];
        let runningTotal = 0;
        for (let total of totals) {
            limitedTotals.push(total);
            runningTotal += total.amount;
            if (runningTotal > totalThreshold) break;
        }
        return limitedTotals;
    }

    _getAmountPosition() {
        if (!this._amtPosition) {
            this._amtPosition = this._getFieldPosition(csvSettings.amountColumnName);
        }
        return this._amtPosition;
    }

    _getFieldPosition(fieldName) {
        return this._headersArray.findIndex((v) => {
            return (v === fieldName);
        });
    }

    _getTotalsByService() {
        if (!this._totals) {
            const serviceNameColumnPosition = this._getFieldPosition(csvSettings.serviceColumnName);
            const amountColumnPosition = this._getAmountPosition();
            this._totals = this._dataArray.reduce((runningTotalsByService, nextDataRow) => {
                return this._addToRunningTotalByService(runningTotalsByService, nextDataRow[serviceNameColumnPosition], parseFloat(nextDataRow[amountColumnPosition]));
            }, []);
        }
        return this._totals;
    }

    _addToRunningTotalByService(runningTotals, serviceName, amount) {
        const serviceTotalIndex = runningTotals.findIndex(service => service.serviceName === serviceName);
        if (serviceTotalIndex < 0) {
            runningTotals.push({serviceName: serviceName, amount: amount});
        } else {
            runningTotals[serviceTotalIndex].amount += amount;
        }
        return runningTotals;
    }

};

