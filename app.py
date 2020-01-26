#!/usr/bin/env python

import os
import sqlite3
from flask import Flask,\
                  render_template,\
                  jsonify
app = Flask(__name__)

dataTemplate = [
    {
        "key": "unixtime",
        "id": 0,
        "title": "time",
        "color": "none"
    }, {
        "key": "temp",
        "id": 1,
        "title": "T ['C]",
        "color": "#ffab00"
    }, {
        "key": "freq",
        "id": 2,
        "title": "cpu frequency [GHz]",
        "color": "#ba3dc7"
    }, {
        "key": "volt",
        "id": 3,
        "title": "voltage [V]",
        "color": "#f23a08"
    }, {
        "key": "memused",
        "id": 4,
        "title": "memory usage [MB]",
        "color": "#2438e8"
    }
]

plotIntervalRegimes = {
    "10m": 10 * 60,
    "1h": 3600,
    "6h": 6 * 3600,
    "24h": 24 * 3600
}

def getLatestDB():
    for root, dirs, files in os.walk("log"):
        file = sorted(files)[-1]
        return os.path.join(root, file)

def getLatestData(dbfile):
    conn = sqlite3.connect(dbfile)
    curs = conn.cursor()
    data = curs.execute("SELECT * FROM PERF_DATA").fetchall()
    conn.close()
    return data

@app.route('/', methods=['GET'])
@app.route('/home', methods=['GET'])
def index():
    entries = []
    for dt in dataTemplate:
        if (dt['id'] != 0):
            entries.append(dt['key'])
    return render_template('index.html', entries=entries)

@app.route('/_getData', methods=['GET'])
def getData():
    data = getLatestData(getLatestDB())
    json_data = []
    for dat in data:
        temp = {}
        for dt in dataTemplate:
            temp.update({dt['key']: dat[dt['id']]})
        json_data.append(temp)
    return jsonify(json_data)

@app.context_processor
def globalNamespace():
    global_variables = {
        'dataTemplate': dataTemplate,
        'intervalRegimes': plotIntervalRegimes,
        'memtot': int(os.popen("free -m -t | awk 'NR==4' | awk '{print $2'}").readline())
    }
    return dict(globalNamespace = global_variables)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=3000)
