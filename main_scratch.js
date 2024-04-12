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
    d3.csv("datasets/presidents.csv").then(function (data) {
        // console.log(data);

        // ---------------- Dorling Cartogram ----------------

        {
            d3.csv("datasets/electoral_college_2016.csv").then(function (ec_data) {
                const applySimulation = (nodes) => {
                    const simulation = d3.forceSimulation(nodes)
                        .force("x", d3.forceX().x(d => d.x).strength(0.03))
                        .force("y", d3.forceY().y(d => d.y).strength(0.03))
                        .force("charge", d3.forceManyBody().strength(20))
                        .force("collide", d3.forceCollide().radius(d => d.r + 2).strength(0.1))
                        .alphaDecay(0.125)
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
                    .range([2 * 3, 2 * 55]);

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

                const simulation = d3.forceSimulation(states.features.map((d) => d.properties))
                    .force("x", d3.forceX().x(d => d.x))
                    .force("y", d3.forceY().y(d => d.y))
                    .force("charge", d3.forceManyBody().strength(50))
                    .force("collide", d3.forceCollide().radius(d => d.r + 2))
                    .alphaDecay(0.125)
                    .on('tick', ticked);

                const bubbles = d3.select(dorlingSvg.node())
                    .append("g")
                    .classed("centroids", true)

                function ticked() {
                    let bubbles_group = bubbles.selectAll("g")
                        .data(states.features.map((d) => d.properties))

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

                }

            })
        }
    })
})