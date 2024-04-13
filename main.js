const chart_margin = { top: 30, right: 30, bottom: 70, left: 60 },
    chart_width = 1000 - chart_margin.left - chart_margin.right,
    chart_height = 620 - chart_margin.top - chart_margin.bottom;

const width = chart_width + chart_margin.left + chart_margin.right;
const height = chart_height + chart_margin.top + chart_margin.bottom;

const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip");

const heroSvg = d3.select("#hero");
let main = d3.select("main");
let scrolly = main.select("#scrolly");
let svg = scrolly.select("#hero");
let article = scrolly.select("article");
let step = article.selectAll(".step");

// initialize the scrollama
let scroller = scrollama();

let us, data, ec_data, cr_data, winningParties_, winningMargins_, winningParties;
let winnersPerYearPerState_ = {}, winnersGrid = [];
let simulationLarge, simulationSmall;

// Initialize data and maps
d3.json('maps/states-albers-10m.json').then(function (us_in) {
    d3.csv("datasets/presidents.csv").then(function (data_in) {
        d3.csv("datasets/electoral_college_2016.csv").then(function (ec_data_in) {
            d3.csv("datasets/county_level_results_2016.csv").then(function (cr_data_in) {
                us = us_in;
                data = data_in;
                ec_data = ec_data_in;
                cr_data = cr_data_in;

                init();

                winningParties_ = d3.rollups(data, (v) => {
                    let maxInd = d3.maxIndex(v, (d) => +d.candidatevotes);
                    return {
                        winner: v[maxInd].party_simplified,
                        state_name: v[maxInd].state
                    };
                }, d => d.year, d => d.state_fips);

                winningMargins_ = d3.rollups(data, (v) => {
                    let candidatevotes_ = [];
                    v.forEach(d => candidatevotes_.push(d.candidatevotes));
                    let votes_sorted = d3.sort(candidatevotes_, (a, b) => d3.descending(a.value, b.value));
                    return (votes_sorted[0] - votes_sorted[1]) / v[0].totalvotes;
                }, d => d.year, d => d.state_fips);

                winningParties = {};
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
            })
        })
    })
});

// scrollama event handlers
function handleStepEnter(response) {
    // add color to current step only
    step.classed("is-active", (d, i) => {
        return i === response.index;
    });

    // update graphic based on step
    switch (response.index) {
        case 0:
            clean();
            svg.append('image')
                .attr('xlink:href', 'assets/potus_seal.svg')
                .attr('x', width / 2 - 250)
                .attr('y', height / 2 - 250)
                .attr('width', 500)
                .attr('height', 500);
            break;
        case 1:
            clean();
            createHistoricalCholoropleth();
            break;
        case 2:
            clean();
            createDorlingCartogram();
            break;
        case 3:
            clean();
            createHistoricalVotingChart();
            break;
        case 4:
            clean();
            createHistoricalStaticVotingChart();
            break;
        case 5:
            clean();
            createRecentStaticVotingChart();
            break;
        case 6:
            clean();
            createSwingStatesChloropleth();
            break;
        case 7:
            clean();
            createCountyVotingChart();
            break;
        default:
            clean();
            break;
    }
}

function init() {
    handleResize();
    scroller
        .setup({
            step: "#scrolly article .step",
            offset: 0.33,
            // debug: true
        })
        .onStepEnter(handleStepEnter);

    // setup resize event
    window.addEventListener('resize', handleResize);
}

// generic window resize listener event
function handleResize() {
    let stepH = Math.floor(window.innerHeight * 0.8);
    step.style("min-height", stepH + "px");
    let svgHeight = Math.max(window.innerHeight * 0.75, height);
    let svgWidth = Math.max(window.innerWidth, width);
    let svgMarginTop = (window.innerHeight - svgHeight) / 2;
    svg
        .attr("height", svgHeight + "px")
        .attr('width', svgWidth + "px")
        .style("top", svgMarginTop + "px");
    scroller.resize();
}

// Helper functions
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

function stopSimulations() {
    simulationLarge.stop();
    simulationSmall.stop();
}

function clean() {
    heroSvg.selectAll('*').remove();
    tooltip.style("opacity", 0);
    if (simulationLarge){
        stopSimulations();
    }
}

// Rendering functions
function createHistoricalCholoropleth() {
    let yearSelected = "2016";

    updateChloroplethStates(heroSvg, winningParties, yearSelected);

    let demVotes = d3.sum(data.filter(d => d.year == yearSelected && d.party_simplified == 'DEMOCRAT'), d => +d.candidatevotes);
    let repVotes = d3.sum(data.filter(d => d.year == yearSelected && d.party_simplified == 'REPUBLICAN'), d => +d.candidatevotes);
    let totalVotes = d3.sum(data.filter(d => d.year == yearSelected), d => +d.candidatevotes);
    let votesScale = d3.scaleLinear().domain([0, totalVotes]).range([0, 500]);

    svg.append('rect')
        .classed('blue-state', true)
        .attr('x', 0.35 * width)
        .attr('y', 10)
        .attr('height', 30)
        .attr('width', votesScale(demVotes));

    svg.append('text')
        .attr('x', 0.35 * width + votesScale(demVotes) / 2)
        .attr('y', 30)
        .text(`${(demVotes / totalVotes).toFixed(2) * 100}%`)
        .attr('class', 'bar-annotation');

    svg.append('rect')
        .classed('red-state', true)
        .attr('x', 0.35 * width + votesScale(demVotes))
        .attr('y', 10)
        .attr('height', 30)
        .attr('width', votesScale(repVotes));

    svg.append('text')
        .attr('x', 0.35 * width + votesScale(demVotes) + votesScale(repVotes) / 2)
        .attr('y', 30)
        .text(`${(repVotes / totalVotes).toFixed(2) * 100}%`)
        .attr('class', 'bar-annotation');

    // const yearSelect = d3.select("#year-selector")
    // yearSelect.on("input", function (event) {
    //     yearSelected = this.value;
    //     updateChloroplethStates(chloroplethSvg, winningParties, yearSelected);
    // });
}

function createDorlingCartogram() {
    const applySimulation = (nodes) => {
        const simulation = d3.forceSimulation(nodes)
            .force("x", d3.forceX().x(d => d.x).strength(0.03))
            .force("y", d3.forceY().y(d => d.y).strength(0.03))
            .force("charge", d3.forceManyBody().strength(20))
            .force("collide", d3.forceCollide().radius(d => d.r + 1).strength(0.5))
            .stop()

        while (simulation.alpha() > 0.01) {
            simulation.tick()
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
    const baseMap = heroSvg.node();

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

    let demVotes = 232;
    let repVotes = 306;
    let totalVotes = 538;
    let votesScale = d3.scaleLinear().domain([0, totalVotes]).range([0, 500]);

    svg.append('rect')
        .classed('blue-state', true)
        .attr('x', 0.35 * width)
        .attr('y', 30)
        .attr('height', 30)
        .attr('width', votesScale(demVotes));

    svg.append('text')
        .attr('x', 0.35 * width + votesScale(demVotes) / 2)
        .attr('y', 50)
        .text(`${demVotes}`)
        .attr('class', 'bar-annotation');

    svg.append('rect')
        .classed('red-state', true)
        .attr('x', 0.35 * width + votesScale(demVotes))
        .attr('y', 30)
        .attr('height', 30)
        .attr('width', votesScale(repVotes));

    svg.append('text')
        .attr('x', 0.35 * width + votesScale(demVotes) + votesScale(repVotes) / 2)
        .attr('y', 50)
        .text(`${repVotes}`)
        .attr('class', 'bar-annotation');

    svg.append('line')
        .attr('x1', 0.35 * width + votesScale(270))
        .attr('x2', 0.35 * width + votesScale(270))
        .attr('y1', 20)
        .attr('y2', 70)
        .attr('stroke', 'black')
        .attr('stroke-width', '2')
        .attr('stroke-dasharray', '3 3');

    svg.append('text')
        .attr('x', 0.35 * width + votesScale(256))
        .attr('y', 90)
        .text('270')
        .attr('font-weight', 'bold');

}

function createSwingStatesChloropleth() {
    let yearSelected = "2016";

    updateChloroplethStates(heroSvg, winningParties, yearSelected);

    let opacityScale = d3.scaleLinear()
        .domain(d3.extent(Object.keys(winningParties[yearSelected]), (d) => winningParties[yearSelected][d].winningPercentage))
        .range([0.3, 1]);

    heroSvg.selectAll('path')
        .style('opacity', (d) => opacityScale(winningParties[yearSelected][d.id].winningPercentage));
}

function createHistoricalVotingChart() {
    let years = Object.keys(winningParties);
    let state_names = Object.keys(winnersPerYearPerState_);

    let y = d3.scaleBand().domain(years).range([chart_margin.top, height - chart_margin.bottom * 2.5]).paddingInner(1);
    let x = d3.scalePoint().domain(state_names).range([chart_margin.left * 1.5, width - chart_margin.right]);

    heroSvg.append("g")
        .attr('transform', `translate(-20, 0)`)
        .classed('chart-container', true);

    let container = heroSvg.select('.chart-container');

    const xAxisGroup = container.append("g")
        .attr("transform", `translate(-12, ${(height - chart_margin.bottom * 2.1)})`)
        .classed("axis", true)
        .call(d3.axisBottom(x));

    xAxisGroup.selectAll('text')
        .attr("transform", "rotate(-90)")
        .attr("text-anchor", "end");

    container.append("g")
        .attr("transform", `translate(${chart_margin.left * 1.2}, 0)`)
        .classed("axis", true)
        .call(d3.axisLeft(y));

    container.selectAll(".historical-vote")
        .data(winnersGrid)
        .enter()
        .append("circle")
        .classed("historical-vote", true)
        .attr('r', 5)
        .attr('cx', d => x(d[0]))
        .attr('cy', d => y(d[1]))
        .classed('blue-state', d => d[2] == 'D')
        .classed('red-state', d => d[2] == 'R')
        .classed('other-state', d => d[2] == 'O');

    container
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

function createHistoricalStaticVotingChart() {

    let years = Object.keys(winningParties);

    let y = d3.scaleBand().domain(years).range([chart_margin.top, height - chart_margin.bottom * 2.5]).paddingInner(1);

    let staticStates = ['ALASKA', 'DISTRICT OF COLUMBIA', 'IDAHO', 'KANSAS',
        'MINNESOTA', 'NEBRASKA', 'NORTH DAKOTA', 'OKLAHOMA', 'SOUTH DAKOTA', 'UTAH', 'WYOMING']

    let xStatic = d3.scaleBand().domain(staticStates).range([chart_margin.left * 1.5, width / 2 - chart_margin.right]);

    heroSvg.append("g")
        .attr('transform', `translate(${width / 4}, 0)`)
        .classed('chart-container', true);

    let container = heroSvg.select('.chart-container');

    const xAxisGroupStatic = container.append("g")
        .attr("transform", `translate(-29, ${(height - chart_margin.bottom * 2.1)})`)
        .classed("axis", true)
        .call(d3.axisBottom(xStatic));

    xAxisGroupStatic.selectAll('text')
        .attr("transform", "rotate(-90)")
        .attr("text-anchor", "end");

    container.append("g")
        .attr("transform", `translate(${chart_margin.left * 1.2}, 0)`)
        .classed("axis", true)
        .call(d3.axisLeft(y));

    container.selectAll(".historical-vote")
        .data(winnersGrid.filter(d => staticStates.includes(d[0])))
        .enter()
        .append("circle")
        .classed("historical-vote", true)
        .attr('r', 5)
        .attr('cx', d => xStatic(d[0]))
        .attr('cy', d => y(d[1]))
        .classed('blue-state', d => d[2] == 'D')
        .classed('red-state', d => d[2] == 'R')
        .classed('other-state', d => d[2] == 'O');

    container
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

function createRecentStaticVotingChart() {

    let years = Object.keys(winningParties).filter((d) => +d > 1996);

    let y = d3.scaleBand().domain(years).range([chart_margin.top * 5, height - chart_margin.bottom * 2.5]).paddingInner(1);

    let changingStates = ['ARIZONA', 'COLORADO', 'FLORIDA', 'GEORGIA', 'INDIANA', 'IOWA', 'MICHIGAN', 'NEVADA', 'NEW HAMPSHIRE', 'NEW MEXICO', 'NORTH CAROLINA', 'OHIO', 'PENNSYLVANIA', 'VIRGINIA', 'WISCONSIN']

    let staticStates = Object.keys(winnersPerYearPerState_).filter(d => !changingStates.includes(d));

    let xStatic = d3.scaleBand().domain(staticStates).range([chart_margin.left * 1.5, width - chart_margin.right]);

    heroSvg.append("g")
        .classed('chart-container', true);

    let container = heroSvg.select('.chart-container')
        .attr('transform', `translate(-10, -50)`);

    const xAxisGroupStatic = container.append("g")
        .attr("transform", `translate(-23, ${(height - chart_margin.bottom * 2)})`)
        .classed("axis", true)
        .call(d3.axisBottom(xStatic));

    xAxisGroupStatic.selectAll('text')
        .attr("transform", "rotate(-90)")
        .attr("text-anchor", "end");

    container.append("g")
        .attr("transform", `translate(${chart_margin.left * 1.2}, 0)`)
        .classed("axis", true)
        .call(d3.axisLeft(y));

    container.selectAll(".historical-vote")
        .data(winnersGrid.filter(d => staticStates.includes(d[0]) && +d[1] > 1996))
        .enter()
        .append("circle")
        .classed("historical-vote", true)
        .attr('r', 5)
        .attr('cx', d => xStatic(d[0]))
        .attr('cy', d => y(d[1]))
        .classed('blue-state', d => d[2] == 'D')
        .classed('red-state', d => d[2] == 'R')
        .classed('other-state', d => d[2] == 'O');

    container
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

function createCountyVotingChart() {
    const lowerLim = 20000;
    let processedResults = [];

    cr_data.forEach((d) => {
        let winner = +d.votes_dem > +d.votes_gop ? 'D' : 'R';
        let diff = +d.diff.replaceAll(',', '') * (winner == 'D' ? -1 : 1);
        let per_point_diff = +d.per_point_diff.replaceAll('%', '') * (winner == 'D' ? -1 : 1);
        processedResults.push({
            ...d, winner, diff, per_point_diff
        })
    })

    let radiusScale = d3.scaleSqrt()
        .domain(d3.extent(processedResults, d => d.total_votes))
        .range([0.02, 0.8]);

    let xScaleDem = d3.scaleLinear()
        .domain(d3.extent(processedResults.filter(d => d.winner == 'D' && d.total_votes > lowerLim), d => d.per_point_diff))
        .range([0.1 * width, 0.48 * width]);
    let xScaleRep = d3.scaleLinear()
        .domain(d3.extent(processedResults.filter(d => d.winner == 'R' && d.total_votes > lowerLim), d => d.per_point_diff))
        .range([0.52 * width, 0.9 * width]);

    simulationLarge = d3.forceSimulation(processedResults.filter(d => d.total_votes > 100000))
        .force("charge", d3.forceManyBody().strength(1))
        .force("collide", d3.forceCollide().radius(d => radiusScale(d.total_votes) + 2))
        .force("x", d3.forceX((d) => {
            return d.winner == 'D' ? xScaleDem(d.per_point_diff) : xScaleRep(d.per_point_diff)
        }).strength(2))
        .force("y", d3.forceY(0.275 * height).strength(0.3))
        .on("tick", tickedLarge);

    simulationSmall = d3.forceSimulation(processedResults.filter(d => d.total_votes <= 100000 && d.total_votes > lowerLim))
        .force("charge", d3.forceManyBody().strength(1))
        .force("collide", d3.forceCollide().radius(d => radiusScale(d.total_votes) + 2))
        .force("x", d3.forceX((d) => {
            return d.winner == 'D' ? xScaleDem(d.per_point_diff) : xScaleRep(d.per_point_diff)
        }).strength(2))
        .force("y", d3.forceY(0.75 * height).strength(1.5))
        .on("tick", tickedSmall);

    const skipTicks = 10;

    function tickedLarge() {
        simulationLarge.tick(skipTicks);

        heroSvg
            .selectAll('.highVotes')
            .data(processedResults.filter(d => d.total_votes > 100000))
            .join("circle")
            .classed('highVotes', true)
            .attr('r', d => radiusScale(d.total_votes))
            .attr('cx', d => d.x)
            .attr('cy', d => d.y)
            .attr("fill", d => d.winner == 'D' ? "#0000ff" : "#ff0803")
            .attr("stroke", d => d.winner == 'D' ? "#0000ff" : "#ff0803");

        heroSvg
            .selectAll('.highVotes')
            .on("mouseover", (event, d) => {
                tooltip.style("opacity", 0.9);
                tooltip.html(`${d.winner} has a ${Math.abs(d.per_point_diff)}% winning margin`);

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

    function tickedSmall() {
        simulationSmall.tick(skipTicks);

        heroSvg
            .selectAll('.lessVotes')
            .data(processedResults.filter(d => d.total_votes <= 100000 && d.total_votes > lowerLim))
            .join("circle")
            .classed('lessVotes', true)
            .attr('r', d => radiusScale(d.total_votes))
            .attr('cx', d => d.x)
            .attr('cy', d => d.y)
            .attr("fill", d => d.winner == 'D' ? "#0000ff" : "#ff0803")
            .attr("stroke", d => d.winner == 'D' ? "#0000ff" : "#ff0803");

        heroSvg
            .selectAll('.lessVotes')
            .on("mouseover", (event, d) => {
                tooltip.style("opacity", 0.9);
                tooltip.html(`${d.winner} has a ${Math.abs(d.per_point_diff)}% winning margin`);

                d3.select(event.target)
                    .style('stroke-width', 1)
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

    const PADDING = 30;

    heroSvg
        .append('line')
        .attr('x1', width / 2)
        .attr('x2', width / 2)
        .attr('y1', PADDING * 2)
        .attr('y2', 0.5 * height - PADDING)
        .style('stroke', 'black')
        .style('stroke-dasharray', '4 4')

    heroSvg
        .append('line')
        .attr('x1', xScaleDem(-50))
        .attr('x2', xScaleDem(-50))
        .attr('y1', PADDING)
        .attr('y2', 0.5 * height - PADDING)
        .style('stroke', 'black')
        .style('stroke-dasharray', '2 2')

    heroSvg
        .append('line')
        .attr('x1', xScaleRep(50))
        .attr('x2', xScaleRep(50))
        .attr('y1', PADDING)
        .attr('y2', 0.5 * height - PADDING)
        .style('stroke', 'black')
        .style('stroke-dasharray', '2 2')

    heroSvg
        .append('line')
        .attr('x1', width / 2)
        .attr('x2', width / 2)
        .attr('y1', 0.5 * height + PADDING)
        .attr('y2', height - PADDING * 2)
        .style('stroke', 'black')
        .style('stroke-dasharray', '4 4')

    heroSvg
        .append('line')
        .attr('x1', xScaleDem(-50))
        .attr('x2', xScaleDem(-50))
        .attr('y1', 0.5 * height + PADDING)
        .attr('y2', height - PADDING)
        .style('stroke', 'black')
        .style('stroke-dasharray', '2 2')

    heroSvg
        .append('line')
        .attr('x1', xScaleRep(50))
        .attr('x2', xScaleRep(50))
        .attr('y1', 0.5 * height + PADDING)
        .attr('y2', height - PADDING)
        .style('stroke', 'black')
        .style('stroke-dasharray', '2 2')

    heroSvg.append('text')
        .text("50% Democratic Win Margin")
        .attr('x', xScaleDem(-50))
        .attr('y', 0.5 * height)
        .classed('distribution-label', true);

    heroSvg.append('text')
        .text("0%")
        .attr('x', 0.5 * width)
        .attr('y', 0.5 * height)
        .classed('distribution-label', true);

    heroSvg.append('text')
        .text("50% Republican Win Margin")
        .attr('x', xScaleRep(+50))
        .attr('y', 0.5 * height)
        .classed('distribution-label', true);

    heroSvg.append('text')
        .text("Counties with Total Votes > 100k")
        .attr('x', 0.5 * width)
        .attr('y', 50)
        .classed('distribution-title', true);

    heroSvg.append('text')
        .text("Counties with Total Votes < 100k")
        .attr('x', 0.5 * width)
        .attr('y', height - 34)
        .classed('distribution-title', true);
}
