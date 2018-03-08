"use strict";
const { promisify } = require( "es6-promisify" );
const csvParse = promisify( require( "csv-parse" ) );
const csvSettings = require( "./billingReporterSettings.json" ).csv;


module.exports = class BillingReport {

    processData( data ) {
        return csvParse( data ).then( ( parsedData ) => {
            this._headersArray = parsedData.shift( 1 );
            this._dataArray = parsedData;
            return data;
        } );
    }

    getTotalAmount() {
        const amountColumnIndex = this._getAmountPosition();

        return this._dataArray.map( ( row ) => row[ amountColumnIndex ] ).reduce( ( a, b ) => {
            a = isNaN( a ) ? 0 : parseFloat( a );
            b = isNaN( b ) ? 0 : parseFloat( b );
            return a + b;
        } );
    }

    getSingleServiceTotal( serviceName ) {
        const totals = this._getTotalsByService();

        return totals.find( ( service ) => service.serviceName === serviceName );
    }

    _getAmountPosition() {
        if ( !this._amtPosition ) {
            this._amtPosition = this._getFieldPosition( csvSettings.amountColumnName );
        }
        return this._amtPosition;
    }

    _getFieldPosition( fieldName ) {
        return this._headersArray.findIndex( ( v ) => {
            return ( v === fieldName );
        } );
    }

    _getTotalsByService() {
        if ( !this._totals ) {
            const serviceNameColumnPosition = this._getFieldPosition( csvSettings.serviceColumnName );
            const amountColumnPosition = this._getAmountPosition();

            this._totals = this._dataArray.reduce( ( runningTotalsByService, nextDataRow ) => {
                return this._addToRunningTotalByService( runningTotalsByService, nextDataRow[ serviceNameColumnPosition ], parseFloat( nextDataRow[ amountColumnPosition ] ) );
            }, [] );
        }
        return this._totals;
    }

    _addToRunningTotalByService( runningTotals, serviceName, amount ) {
        const serviceTotalIndex = runningTotals.findIndex( ( service ) => service.serviceName === serviceName );

        if ( serviceTotalIndex < 0 ) {
            runningTotals.push( { "serviceName": serviceName, "amount": amount } );
        } else {
            runningTotals[ serviceTotalIndex ].amount += amount;
        }
        return runningTotals;
    }

};

