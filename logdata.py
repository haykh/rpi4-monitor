#!/usr/bin/env python

import os
from time import sleep, strftime, time
import sqlite3

REFRESH_RATE = 1 # seconds

def measureTemp():
    temp = os.popen("vcgencmd measure_temp | cut -d = -f 2").readline()
    return float(temp[:-3])

def measureFreq():
    freq = os.popen("vcgencmd measure_clock arm | cut -d = -f 2").readline()
    return float(freq)

def measureVolt():
    volt = os.popen("vcgencmd measure_volts| cut -d = -f 2").readline()
    return float(volt[:-2])

def memoryUsage():
    total = os.popen("free -m -t | awk 'NR==4' | awk '{print $2'}").readline()
    used = os.popen("free -m -t | awk 'NR==4' | awk '{print $3'}").readline()
    return (int(total), int(used))

def createDB():
    dbname = 'log/{}.db'.format(strftime('%s'))
    con = sqlite3.connect(dbname)
    with con:
        cur = con.cursor()
        cur.execute("DROP TABLE IF EXISTS PERF_DATA")
        cur.execute("""
                    CREATE TABLE PERF_DATA(unixtime INTEGER,
                                           temp REAL,
                                           freq NUMERIC,
                                           volt REAL,
                                           memused NUMERIC,
                                           memtot NUMERIC)
                    """)
    return dbname

def logData(dbname,
            time, temp, freq, volt, used_mem, total_mem):
    conn = sqlite3.connect(dbname)
    curs = conn.cursor()
    curs.execute("INSERT INTO PERF_DATA values((?), (?), (?), (?), (?), (?))",
                 (time, temp, freq, volt, used_mem, total_mem))
    conn.commit()
    conn.close()


def main():
    my_current_db = createDB()
    while True:
        time = strftime('%s')
        temp = measureTemp()
        freq = measureFreq()
        volt = measureVolt()
        total, used = memoryUsage()
        # print (time, temp, freq, volt, total, used)
        logData(my_current_db, time, temp, freq, volt, used, total)
        sleep(REFRESH_RATE)

if __name__ == "__main__":
    main()
