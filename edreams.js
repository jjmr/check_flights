var http = require('http');
var jsdom = require("jsdom");
var nodemailer = require("nodemailer");
var async = require('async');
var webshot = require('webshot');

// create reusable transport method (opens pool of SMTP connections)
var smtpTransport = nodemailer.createTransport("SMTP",{
    service: "Gmail",
    auth: {
        user: "***",
        pass: "***"
    }
});
var MAX_ITEMS = 5;
var text = "";
var cookies = [];

var send_mail = function(err, files) {
	var mailOptions = {
        from: "***", // sender address
        to: "***", // list of receivers
        subject: "Precios del día", // Subject line
        html: text // html body,
	}

	var attachments = [];
	files.forEach(function(file) {
		attachments.push({   // file on disk as an attachment
            fileName: file,
            filePath: file // stream this file
        });
    });
	mailOptions['attachments'] = attachments;
    
    smtpTransport.sendMail(mailOptions, function(error, response){
        if(error){
            console.log(error);
        }else{
            console.log("Message sent: " + response.message);
        }
        process.exit(0);
    });
};

var get_file_name = function(ini, mid, end, direct) {
	var filename = ini + '_' + mid + '_' + end + '_';
	if (direct === 'on') {
		filename += 'directo.png';
	} else {
		filename += 'escalas.png';
	}
	return filename;
}

var callback_search = function(ini, mid, end, direct, callback) {
	return function(resp) {
		var str = '';
		resp.on('data', function(chunk) {
		    str += chunk;
		});
		resp.on('end', function() {
			str = str.replace('<head>', '<head> <base href="http://www.edreams.es">');

			webshot(str, get_file_name(ini, mid, end, direct), 
				{
                    siteType:'html', 
                    defaultWhiteBackground: true, 
                    renderDelay: 20000
                }, function(err) {
					if (err) {
						console.log(err);
					}
					jsdom.env(
						str,
						["http://code.jquery.com/jquery.js"],
						function (errors, window) {
							var search_text = '<ul>';
							var counter = 0;
						    window.$(".singleItinerayPrice").each(function(i, d){
								if (counter++ < MAX_ITEMS) {
							        search_text += '<li>' + window.$(d).text() + '</li>';
								}
						    });
							search_text += '</ul>';

							text += search_text;               

							console.log(search_text);
							callback(null, get_file_name(ini, mid, end, direct));
					});
			});
		});
	};
};

var search_dates = function(ini, mid, end, direct) {
	return function(callback) {
		var options_search = {
		        host: 'www.edreams.es',
		        path: '/engine/ItinerarySearch/search',
		        method: 'POST',
		        headers: {
		            'User-Agent': 'Mozilla/5.0 (X11; Linux i686; rv:27.0) Gecko/20100101 Firefox/27.0',
		            'Host': 'www.edreams.es',
		            'Accept': 'text/html',
		            'Connection': 'keep-alive',
		            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
		            'content-Length': 751, 
		            'Cookie': cookies}
		    };

			text += '<h3>Salida de Madrid el '+ ini +' , salida de Miami el ' + mid +' , vuelta a Madrid el ' + end + '</h3>';
			console.log(text);

		    var req = http.request(options_search, callback_search(ini, mid, end, direct, callback));
			req.write('buyPath=36&auxOrBt=&searchMainProductTypeName=FLIGHT&tripTypeName=MULTI_SEGMENT&departureLocationGeoNodeId0=9748&departureLocation0=Madrid&arrivalLocationGeoNodeId0=9773&arrivalLocation0=Nueva+York%2C+NY&departureDate0='+ini+'%2F07%2F2014&departureLocationGeoNodeId1=9773&departureLocation1=Nueva+York%2C+NY&arrivalLocationGeoNodeId1=9763&arrivalLocation1=Miami%2C+FL&departureDate1='+mid+'%2F08%2F2014&departureLocationGeoNodeId2=9763&departureLocation2=Miami%2C+FL&arrivalLocationGeoNodeId2=9748&arrivalLocation2=Madrid&departureDate2='+end+'%2F08%2F2014&numAdults=2&numChilds=0&numInfants=0&filterDirectFlights='+direct+'&cabinClassName=TOURIST&filteringCarrier=&fake_filteringCarrier=Todas+las+compa%C3%B1%C3%ADas&collectionTypeEstimationNeeded=false&applyAllTaxes=false');
		    req.end();
	}
};

var callback_get = function(resp) {
    resp.on('end', function() {
        resp.headers['set-cookie'].forEach(function(c){
            cookies.push(c.split(';')[0]);
        });
        
		async.series([
			search_dates('15', '04', '12', 'on'),
			search_dates('22', '04', '12', 'on'),
			search_dates('29', '04', '12', 'on'),
			search_dates('29', '04', '12', 'off')
		], send_mail);
        
    });
};

var options = {
    host: 'www.edreams.es',
    path: '/',
    method: 'GET'
}
var req = http.request(options, callback_get);
req.end();
