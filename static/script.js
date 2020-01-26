// read & interpret data from the app
var titleDict = {};
for (let i = 1; i < dataTemplate.length; ++i) {
  let transformXY;
  if (dataTemplate[i]['key'] == 'freq')
    transformXY = (x, y) => [x, y / 1e9];
  else
    transformXY = (x, y) => [x, y];
  let dt = {
    'label': dataTemplate[i]['title'],
    'color': dataTemplate[i]['color'],
    'transformXY': transformXY
  };
  titleDict[dataTemplate[i]['key']] = dt;
}
// temporal regimes
var activeRegime = '10m';
var allIntervals = null;

async function initializeDOM() {
  // sort timeRegimes
  let items = Object.keys(timeRegimes).map(function(key) {
    return [key, timeRegimes[key]];
  });
  items.sort(function(first, second) {
    return -second[1] + first[1];
  });
  timeRegimes = {};
  for (let i = 0; i < items.length; ++i) {
    timeRegimes[items[i][0]] = items[i][1];
  }
  // initialize regime buttons
  let btnGroup = document.getElementsByClassName('regime-group')[0];
  for (let key in timeRegimes) {
    let btn = document.createElement("a");
    btn.innerHTML = key;
    btnGroup.getElementsByTagName('center')[0].appendChild(btn);
    if (key == activeRegime) {
      btn.classList.add('active');
    }
    btn.addEventListener("click", function(){
      activeRegime = key;
      resetAllPlots();
      let els = btnGroup.querySelectorAll('.active');
      for (var i = 0; i < els.length; i++) {
        els[i].classList.remove('active');
      }
      btn.classList.add('active');
    });
  }
}

function resetAllPlots() {
  if (allIntervals) {
    for (let i = 0; i < allIntervals.length; ++i)
      clearInterval(allIntervals[i]);
  }
  allIntervals = [];
  for (let key in titleDict) {
    fetchData(key);
    setInterval(function() { fetchData(key); }, REFRESH_RATE);
  }
}

window.addEventListener('load', function() {
  initializeDOM().then(function() {
    resetAllPlots();
  })
});

function fetchData(key) {
  let request = new XMLHttpRequest();
  request.open("GET", '/_getData');
  request.send();

  request.onload = function() {
    let response = JSON.parse(request.response);
    removeChildren(document.getElementById(key));
    plotLine(key, response, timeRegimes[activeRegime],
             'unixtime', 'time').then(function() {
      let plt = document.getElementById(key);
      let lines = plt.getElementsByClassName("line");
      for (let i = 0; i < lines.length; ++i)
        lines.item(i).style.stroke = titleDict[key]['color'];
      let areas = plt.getElementsByClassName("area");
      for (let i = 0; i < areas.length; ++i)
        areas.item(i).style.fill = 'url(#gradient-' + key + ')';
    });
  };
}

function displayJsonData(json) {
  let template = {'<>': 'div', 'html': '${time} ${temp} ${freq}'};
  let myJson = json2html.transform(json, template);
  displayData(myJson);
}

function displayData(json) {
  let main_container = document.getElementsByClassName('container')[0];
  removeChildren(main_container)
  main_container.innerHTML = json;
}

function removeChildren(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

async function plotLine(key, json, time_limit,
                  keyX, xtitle) {
  let objID = key;
  let keyY = key;
  let ytitle = titleDict[key]['label'];
  let transformXY = titleDict[key]['transformXY'];

  let margin = {top: 50, right: 50, bottom: 50, left: 50},
      width = 400 - margin.left - margin.right,
      height = 300 - margin.top - margin.bottom;

  let dataset = [];
  for (let i = 0; i < json.length; ++i) {
    let x, y;
    [x, y] = transformXY(json[i][keyX] - json[json.length - 1][keyX],
                         json[i][keyY]);
    if (x > -time_limit)
      dataset.push([x, y]);
  }
  let xlim = {xmin: -timeRegimes[activeRegime], xmax: 0};
  let ymin = d3.min(dataset, d => d[1]);
  let ymax = d3.max(dataset, d => d[1]);
  if (ymax != ymin) {
    ymax += 0.33 * (ymax - ymin);
    ymin -= 0.33 * (ymax - ymin);
  } else {
    ymax *= 1.5;
    ymin /= 2;
  }
  let ylim = {ymin: ymin, ymax: ymax};

  let xScale = d3.scaleLinear()
      .domain([xlim.xmin, xlim.xmax])
      .range([0, width]);

  let yScale = d3.scaleLinear()
      .domain([ylim.ymin, ylim.ymax])
      .range([height, 0]);

  let line = d3.line()
      .x(function(d) { return xScale(d[0]); })
      .y(function(d) { return yScale(d[1]); })
      .curve(d3.curveMonotoneX);
  let area = d3.area()
      .x(function(d) { return xScale(d[0]); })
      .y0(height)
      .y1(function(d) { return yScale(d[1]); })
      .curve(d3.curveMonotoneX);

  let time_values, convert_time, units;
  if (activeRegime == '10m') {
    time_values = [0, -5*60, -10*60];
    convert_time = function(d) { return d/60; };
    units = 'min';
  } else if (activeRegime == '1h') {
    time_values = [0, -20*60, -40*60, -60*60];
    convert_time = function(d) { return d/60; };
    units = 'min';
  } else if (activeRegime == '6h') {
    time_values = [0, -2*60*60, -4*60*60, -6*60*60];
    convert_time = function(d) { return d/3600; };
    units = 'hrs';
  } else if (activeRegime == '24h') {
    time_values = [0, -4*60*60, -8*60*60, -12*60*60, -16*60*60, -20*60*60, -24*60*60];
    convert_time = function(d) { return d/3600; };
    units = 'hrs';
  } else {
    console.log('SOMETHING IS WRONG!');
  }

  let yaxis = d3.axisLeft(yScale).ticks(5);
  let yaxis_grid = d3.axisLeft(yScale).ticks(5).tickSize(-width).tickFormat('');
  let xaxis = d3.axisBottom(xScale)
                .tickValues(time_values)
                .tickFormat(convert_time);
  let xaxis_grid = d3.axisBottom(xScale).ticks(5).tickSize(-height).tickFormat('');

  let svg = d3.select("#" + objID).append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
    .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  svg.append("g")
      .attr("class", "x axis-grid")
      .attr("transform", "translate(0," + height + ")")
      .call(xaxis_grid);
  svg.append("g")
      .attr("class", "y axis-grid")
      .call(yaxis_grid);

  svg.append("path")
    .datum(dataset)
      .attr("class", "line")
      .attr("d", line);

  svg.append("path")
    .datum(dataset)
      .attr("class", "area")
      .attr("d", area);
   svg.append("linearGradient")
      .attr("id", "gradient-" + objID)
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", 0).attr("y1", yScale(ylim.ymin))
      .attr("x2", 0).attr("y2", yScale(ylim.ymax))
    .selectAll("stop")
      .data([
        {offset: "0%", color: "black", opacity: "0.2"},
        {offset: "80%", color: titleDict[key]['color'], opacity: "1"}
      ])
    .enter().append("stop")
      .attr("offset", function(d) { return d.offset; })
      .attr("stop-color", function(d) { return d.color; })
      .attr("stop-opacity", function(d) { return d.opacity; });

  svg.append("g")
      .style("font", "12px 'DecimaMonoPro',monospace")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + height + ")")
      .call(xaxis);
  svg.append("g")
      .style("font", "12px 'DecimaMonoPro',monospace")
      .attr("class", "y axis")
      .call(yaxis);

  svg.append("text")
      .style("font", "14px 'DecimaMonoPro',monospace")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left)
      .attr("x",0 - (height / 2))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .text(ytitle);

  svg.append("text")
      .style("font", "12px 'DecimaMonoPro',monospace")
      .attr("transform",
            "translate(" + (width/2) + " ," +
                           (height + margin.top - 20) + ")")
      .style("text-anchor", "middle")
      .text(xtitle + " [" + units + "]");
}
