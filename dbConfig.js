var msql = require('mysql');
var conn = msql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'tackytingsdb'
});

conn.connect(function(err) {
    if (err) throw err;
    console.log('database connected');
});

module.exports = conn