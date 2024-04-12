const chart_margin = { top: 30, right: 30, bottom: 70, left: 60 },
    chart_width = 1000 - chart_margin.left - chart_margin.right,
    chart_height = 600 - chart_margin.top - chart_margin.bottom,
    large_chart_height = 1000 - chart_margin.top - chart_margin.bottom;

const width = chart_width + chart_margin.left + chart_margin.right;
const height = chart_height + chart_margin.top + chart_margin.bottom;
const large_height = large_chart_height + chart_margin.top + chart_margin.bottom;

var main = d3.select("#main");

const chloroplethSvg = d3.select("#yearly-chloropleth")
    .attr("width", width)
    .attr("height", height);

const dorlingSvg = d3.select("#dorling")
    .attr("width", width)
    .attr("height", height);

const historicalSvg = d3.select("#historical-voting")
    .attr("width", width)
    .attr("height", large_height);

const historicalStaticSvg = d3.select("#historical-static")
    .attr("width", width)
    .attr("height", height / 2);

const swingSvg = d3.select("#swing-states")
    .attr("width", width)
    .attr("height", height);

const countySvg = d3.select("#county-votes")
    .attr("width", width)
    .attr("height", height);

const blueHex = "#25428f";
const redHex = "#cc0a11"

const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip");

d3.json('maps/states-albers-10m.json').then(function (us) {
    d3.json('maps/counties-albers-10m.json').then(function (counties) {
        d3.csv("datasets/presidents.csv").then(function (data) {
            d3.csv("datasets/electoral_college_2016.csv").then(function (ec_data) {
                d3.csv("datasets/county_level_results_2016.csv").then(function (cr_data) {
                    // console.log(data);

                    let winningParties_ = d3.rollups(data, (v) => {
                        let maxInd = d3.maxIndex(v, (d) => +d.candidatevotes);
                        return {
                            winner: v[maxInd].party_simplified,
                            state_name: v[maxInd].state
                        };
                    }, d => d.year, d => d.state_fips);

                    let winningMargins_ = d3.rollups(data, (v) => {
                        let candidatevotes_ = [];
                        v.forEach(d => candidatevotes_.push(d.candidatevotes));
                        let votes_sorted = d3.sort(candidatevotes_, (a, b) => d3.descending(a.value, b.value));
                        return (votes_sorted[0] - votes_sorted[1]) / v[0].totalvotes;
                    }, d => d.year, d => d.state_fips);

                    let winningParties = {};
                    winningParties_.forEach(yearEntry => {
                        let year_ = yearEntry[0].toString();

                        if (!winningParties[year_]) {
                            winningParties[year_] = {};
                        }

                        yearEntry[1].forEach(stateEntry => {
                            let state_fip = ("0" + stateEntry[0]).slice(-2)
                            if (!winningParties[year_][state_fip]) {
                                winningParties[year_][state_fip] = {
                                    state_name: '',
                                    party: '',
                                    winningPercentage: 0.0
                                };
                            }

                            winningParties[year_][state_fip] = {
                                state_name: stateEntry[1].state_name,
                                party: stateEntry[1].winner
                            };
                        })
                    });

                    winningMargins_.forEach(yearEntry => {
                        let year_ = yearEntry[0].toString();

                        yearEntry[1].forEach(stateEntry => {
                            let state_fip = ("0" + stateEntry[0]).slice(-2)

                            winningParties[year_][state_fip].winningPercentage = (stateEntry[1] * 100).toFixed(2);
                        })
                    });

                    function updateChloroplethStates(svg_, winningParties, yearSelected) {
                        const path = d3.geoPath();
                        svg_.selectAll('*').remove();

                        svg_.selectAll('path')
                            .data(topojson.feature(us, us.objects.states).features)
                            .join('path')
                            .attr('d', path)
                            .attr('class', 'electionState')
                            .classed('blue-state', d => {
                                const party = winningParties[yearSelected][d.id].party;
                                return party === 'DEMOCRAT';
                            })
                            .classed('red-state', d => {
                                const party = winningParties[yearSelected][d.id].party;
                                return party === 'REPUBLICAN';
                            })
                            .attr('winningParties', d => winningParties[yearSelected][d.id])
                            .style('stroke-width', 0.25)
                            .style('stroke', 'white')
                            .raise();

                        electionStates = svg_.selectAll('.electionState');

                        electionStates
                            .on("mouseover", (event, d) => {
                                tooltip.style("opacity", 0.9);
                                tooltip.html(`${d.properties.name} - Winner: ${winningParties[yearSelected][d.id].party} with a ${winningParties[yearSelected][d.id].winningPercentage}% margin`);

                                d3.select(event.target)
                                    .style('stroke-width', 2)
                                    .style('stroke', 'goldenrod')
                                    .raise();
                            })
                            .on("mouseout", function (event, d) {
                                tooltip.style("opacity", 0);

                                d3.select(event.target)
                                    .style('stroke-width', 0.25)
                                    .style('stroke', 'white')
                                    .raise();
                            })
                            .on("mousemove", function (event, d) {
                                tooltip.style("left", (event.pageX + 10) + "px")
                                    .style("top", (event.pageY - 28) + "px");
                            })
                    }

                    // ------------------- Chloropleth -------------------

                    {
                        let yearSelected = "1976";

                        updateChloroplethStates(chloroplethSvg, winningParties, yearSelected);

                        const yearSelect = d3.select("#year-selector")
                        yearSelect.on("input", function (event) {
                            yearSelected = this.value;
                            updateChloroplethStates(chloroplethSvg, winningParties, yearSelected);
                        });
                    }

                    // ---------------- Dorling Cartogram ----------------

                    {
                        const applySimulation = (nodes) => {
                            const simulation = d3.forceSimulation(nodes)
                                .force("x", d3.forceX().x(d => d.x).strength(0.03))
                                .force("y", d3.forceY().y(d => d.y).strength(0.03))
                                .force("charge", d3.forceManyBody().strength(20))
                                .force("collide", d3.forceCollide().radius(d => d.r + 1).strength(0.5))
                                .stop()

                            while (simulation.alpha() > 0.01) {
                                simulation
                                    .tick()
                            }

                            return simulation.nodes();
                        }

                        const states = topojson.feature(us, us.objects.states);

                        let radiusScale = d3.scaleLinear()
                            .domain(d3.extent(ec_data, (d) => +d.votes))
                            .range([20, 80]);

                        let ec_grouped_by_state = {}
                        ec_data.forEach((d) => {
                            if (!ec_grouped_by_state[d.state]) {
                                ec_grouped_by_state[d.state] = { state_po: '', state_fips: 0, votes: 0, D: 0, R: 0, O: 0 };
                            }
                            ec_grouped_by_state[d.state] = {
                                state_po: d.state_po,
                                state_fips: d.state_fips,
                                votes: +d.votes,
                                D: +d.D,
                                R: +d.R,
                                O: +d.O
                            };
                        });

                        states.features.forEach((feature) => {
                            const [x, y] = d3.geoPath().centroid(feature);
                            const { name } = feature.properties
                            const r = radiusScale(ec_grouped_by_state[name].votes)
                            feature.properties = { ...feature.properties, ...ec_grouped_by_state[name], x, y, r };
                        });

                        const data = states.features.map((d) => d.properties)
                        const values = applySimulation(data)
                        const baseMap = dorlingSvg.node();

                        const bubbles = d3.select(baseMap)
                            .append("g")
                            .classed("centroids", true)

                        let bubbles_group = bubbles.selectAll("g")
                            .data(values)

                        bubbles_group = bubbles_group
                            .join("g")
                            .classed('scatterBubbleGroup', true);

                        // TODO: Add color grading for win margin

                        bubbles_group
                            .classed('scatterBubble', true)
                            .attr("transform", d => `translate(${d.x}, ${d.y})`)
                            .append('circle')
                            .attr("r", (d) => radiusScale(d.votes))
                            .classed('blue-state', d => {
                                return d.D > d.R;
                            })
                            .classed('red-state', d => {
                                return d.R > d.D;
                            });

                        bubbles_group
                            .append('text')
                            .classed('stateText', true)
                            .text(d => d.state_po)
                            .attr('font-size', d => radiusScale(d.votes) / 2)

                        bubbles_group
                            .selectAll('circle')
                            .on("mouseover", (event, d) => {
                                tooltip.style("opacity", 0.9);
                                tooltip.html(`${d.name} has ${d.votes} electoral votes`);

                                d3.select(event.target)
                                    .style('stroke-width', 2)
                                    .style('stroke', 'black');
                            })
                            .on("mouseout", function (event, d) {
                                tooltip.style("opacity", 0);

                                d3.select(event.target)
                                    .style('stroke-width', 0);

                                d3.select(event.target)
                                    .select('text')
                                    .classed('stateText', true);
                            })
                            .on("mousemove", function (event, d) {
                                tooltip.style("left", (event.pageX + 10) + "px")
                                    .style("top", (event.pageY - 28) + "px");
                            })

                    }

                    // ------------------ Swing States  ------------------

                    {
                        let yearSelected = "2016";

                        updateChloroplethStates(swingSvg, winningParties, yearSelected);

                        let opacityScale = d3.scaleLinear()
                            .domain(d3.extent(Object.keys(winningParties[yearSelected]), (d) => winningParties[yearSelected][d].winningPercentage))
                            .range([0.3, 1]);

                        swingSvg.selectAll('path')
                            .style('opacity', (d) => opacityScale(winningParties[yearSelected][d.id].winningPercentage));
                    }

                    // ---------------- Historical Voting ----------------

                    {
                        let winnersPerYearPerState_ = {};
                        let winnersGrid = [];

                        winningParties_.forEach((yearEntry) => {
                            let year_ = yearEntry[0];

                            yearEntry[1].forEach((stateEntry) => {
                                let state_ = stateEntry[1].state_name;
                                let winner = stateEntry[1].winner == 'DEMOCRAT' ? 'D' : stateEntry[1].winner == 'REPUBLICAN' ? 'R' : 'O';

                                if (!winnersPerYearPerState_[state_]) {
                                    winnersPerYearPerState_[state_] = {};
                                }

                                if (!winnersPerYearPerState_[state_][year_]) {
                                    winnersPerYearPerState_[state_][year_] = '';
                                }

                                winnersPerYearPerState_[state_][year_] = winner;
                            })
                        })

                        Object.keys(winnersPerYearPerState_).forEach((state__) => {
                            Object.keys(winnersPerYearPerState_[state__]).forEach((year__) => {
                                winnersGrid.push([state__, year__, winnersPerYearPerState_[state__][year__]]);
                            })
                        })

                        let years = Object.keys(winningParties);
                        let state_names = Object.keys(winnersPerYearPerState_);

                        let x = d3.scalePoint().domain(years).range([chart_margin.left * 2.5, width / 2 - chart_margin.right]);
                        let y = d3.scaleBand().domain(state_names).range([chart_margin.top, large_height - chart_margin.bottom]).paddingInner(1);

                        historicalSvg.append("g")
                            .attr("transform", "translate(0," + (large_height - chart_margin.bottom + 10) + ")")
                            .classed("axis", true)
                            .call(d3.axisBottom(x));

                        historicalSvg.append("g")
                            .attr("transform", `translate(${chart_margin.left * 2.3},0)`)
                            .classed("axis", true)
                            .call(d3.axisLeft(y));

                        historicalSvg.selectAll(".historical-vote")
                            .data(winnersGrid)
                            .enter()
                            .append("circle")
                            .classed("historical-vote", true)
                            .attr('r', 5)
                            .attr('cx', d => x(d[1]))
                            .attr('cy', d => y(d[0]))
                            .classed('blue-state', d => d[2] == 'D')
                            .classed('red-state', d => d[2] == 'R')
                            .classed('other-state', d => d[2] == 'O');

                        historicalSvg
                            .selectAll('.historical-vote')
                            .on("mouseover", (event, d) => {
                                tooltip.style("opacity", 0.9);
                                tooltip.html(`${d[0]} voted ${d[2] == 'D' ? 'Democrat' : d[2] == 'R' ? 'Republican' : 'Other'} in ${d[1]}`);

                                d3.select(event.target)
                                    .style('stroke-width', 1)
                                    .style('stroke', 'black');
                            })
                            .on("mouseout", function (event, d) {
                                tooltip.style("opacity", 0);

                                d3.select(event.target)
                                    .style('stroke-width', 0);
                            })
                            .on("mousemove", function (event, d) {
                                tooltip.style("left", (event.pageX + 10) + "px")
                                    .style("top", (event.pageY - 28) + "px");
                            })

                        // Historically static

                        let staticStates = ['ALASKA', 'DISTRICT OF COLUMBIA', 'IDAHO', 'KANSAS',
                            'MINNESOTA', 'NEBRASKA', 'NORTH DAKOTA', 'OKLAHOMA', 'SOUTH DAKOTA', 'UTAH', 'WYOMING']

                        let yStatic = d3.scaleBand().domain(staticStates).range([chart_margin.top, height / 2 - chart_margin.bottom]).paddingInner(1);

                        historicalStaticSvg.append("g")
                            .attr("transform", "translate(0," + (height / 2 - chart_margin.bottom + 10) + ")")
                            .classed("axis", true)
                            .call(d3.axisBottom(x));

                        historicalStaticSvg.append("g")
                            .attr("transform", `translate(${chart_margin.left * 2.3},0)`)
                            .classed("axis", true)
                            .call(d3.axisLeft(yStatic));

                        historicalStaticSvg.selectAll(".historical-vote")
                            .data(winnersGrid.filter(d => staticStates.includes(d[0])))
                            .enter()
                            .append("circle")
                            .classed("historical-vote", true)
                            .attr('r', 5)
                            .attr('cx', d => x(d[1]))
                            .attr('cy', d => yStatic(d[0]))
                            .classed('blue-state', d => d[2] == 'D')
                            .classed('red-state', d => d[2] == 'R')
                            .classed('other-state', d => d[2] == 'O');

                        historicalStaticSvg
                            .selectAll('.historical-vote')
                            .on("mouseover", (event, d) => {
                                tooltip.style("opacity", 0.9);
                                tooltip.html(`${d[0]} voted ${d[2] == 'D' ? 'Democrat' : d[2] == 'R' ? 'Republican' : 'Other'} in ${d[1]}`);

                                d3.select(event.target)
                                    .style('stroke-width', 1)
                                    .style('stroke', 'black');
                            })
                            .on("mouseout", function (event, d) {
                                tooltip.style("opacity", 0);

                                d3.select(event.target)
                                    .style('stroke-width', 0);
                            })
                            .on("mousemove", function (event, d) {
                                tooltip.style("left", (event.pageX + 10) + "px")
                                    .style("top", (event.pageY - 28) + "px");
                            })
                    }

                    // ------------------ County Voting ------------------

                    {

                        var path = d3.geoPath();

                        let counties_ = topojson.feature(counties, counties.objects.counties);

                        countySvg.selectAll(".county")
                            .data(topojson.feature(counties, counties.objects.counties).features)
                            .enter()
                            .append("path")
                            .attr('class', 'county')
                            .attr("d", path)
                            .style("fill", "lightgray")
                            .style("stroke", "white")
                            .style("stroke-width", 0.5)
                            .style('opacity', 0.5);

                        countySvg.selectAll(".state")
                            .data(topojson.feature(counties, counties.objects.states).features)
                            .enter().append("path")
                            .attr('class', 'state')
                            .attr("d", path)
                            .style("fill", "none")
                            .style("stroke", "gray")
                            .style("stroke-width", 0.5);

                        let countyResultsMap = {};

                        cr_data.forEach((crEntry) => {
                            countyResultsMap[("00000" + crEntry.combined_fips).slice(-5)] = crEntry;
                        });

                        let lengthScale = d3.scaleLog()
                            .domain(d3.extent(cr_data, (d) => +d.diff.replaceAll(',', '')))
                            .range([1, 30]);

                        counties_.features.forEach((feature) => {
                            const [x, y] = d3.geoPath().centroid(feature);
                            if (countyResultsMap[feature.id]) {
                                const l = lengthScale(+countyResultsMap[feature.id].diff.replaceAll(',', ''))
                                feature.properties = { ...feature.properties, ...countyResultsMap[feature.id], x, y, l };
                            } else {
                                feature.properties = { ...feature.properties, x, y, l: 0, diff: '0', total_votes: 0 };
                            }
                        });

                        const data = counties_.features.map((d) => d.properties)

                        countySvg.append('g')
                            .selectAll('path')
                            .data(data)
                            .join("path")
                            .attr("transform", d => `translate(${d.x}, ${d.y})`)
                            .attr("d", d => d.votes_dem > d.votes_gop ? `M4,0 L0,${-d.l}` : `M-4,0 L0,${-d.l}`)
                            .attr("fill", d => d.votes_dem > d.votes_gop ? "#0000ff" : "#ff0803")
                            .attr("stroke", d => d.votes_dem > d.votes_gop ? "#0000ff" : "#ff0803");
                    }
                })
            })
        })
    })
})