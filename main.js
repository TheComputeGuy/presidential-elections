const chart_margin = { top: 30, right: 30, bottom: 70, left: 60 },
    chart_width = 1000 - chart_margin.left - chart_margin.right,
    chart_height = 600 - chart_margin.top - chart_margin.bottom;

const width = chart_width + chart_margin.left + chart_margin.right;
const height = chart_height + chart_margin.top + chart_margin.bottom;

var main = d3.select("#main");

const chloroplethSvg = d3.select("#yearly-chloropleth")
    .attr("width", width)
    .attr("height", height);

const dorlingSvg = d3.select("#dorling")
    .attr("width", width)
    .attr("height", height);

const blueHex = "#25428f";
const redHex = "#cc0a11"

const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip");

d3.json('maps/states-albers-10m.json').then(function (us) {
    d3.csv("presidents.csv").then(function (data) {
        // console.log(data);

        // ------------------- Chloropleth -------------------

        {
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
            })

            winningMargins_.forEach(yearEntry => {
                let year_ = yearEntry[0].toString();

                yearEntry[1].forEach(stateEntry => {
                    let state_fip = ("0" + stateEntry[0]).slice(-2)

                    winningParties[year_][state_fip].winningPercentage = (stateEntry[1] * 100).toFixed(2);
                })
            })

            let yearSelected = "1976";

            updateChloropleth(winningParties, yearSelected);

            const yearSelect = d3.select("#year-selector")
            yearSelect.on("input", function (event) {
                yearSelected = this.value;
                updateChloropleth(winningParties, yearSelected);
            });


            function updateChloropleth(winningParties, yearSelected) {
                const path = d3.geoPath();
                chloroplethSvg.selectAll('*').remove();

                chloroplethSvg.selectAll('path')
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
                    // TODO - Fix styles
                    // .classed('flip', d => {
                    //     const party = winningParties[yearSelected][d.id].party;
                    //     const yearPrev = +yearSelected - 4;
                    //     if (yearPrev > 1975) {
                    //         return (winningParties[yearPrev.toString()][d.id].party != party);
                    //     }
                    // })
                    .attr('winningParties', d => winningParties[yearSelected][d.id])
                    .style('stroke-width', 0.25)
                    .style('stroke', 'white')
                    .raise();

                electionStates = chloroplethSvg.selectAll('.electionState');

                electionStates
                    .on("mouseover", (event, d) => {
                        tooltip.style("opacity", 0.9);
                        tooltip.html(d.properties.name + ": " + winningParties[yearSelected][d.id].party + ", " + winningParties[yearSelected][d.id].winningPercentage + "%");

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
        }

        // ---------------- Dorling Cartogram ----------------

        {
            d3.csv("electoral_college_2016.csv").then(function (ec_data) {
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
                        tooltip.html(d.name + ": " + d.votes);

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

            })
        }
    })
})