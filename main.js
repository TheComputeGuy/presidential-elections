const chart_margin = { top: 30, right: 30, bottom: 70, left: 60 },
    chart_width = 1000 - chart_margin.left - chart_margin.right,
    chart_height = 600 - chart_margin.top - chart_margin.bottom;

var main = d3.select("#main");

const chloroplethSvg = d3.select("#yearly-chloropleth")
    .attr("width", chart_width + chart_margin.left + chart_margin.right)
    .attr("height", chart_height + chart_margin.top + chart_margin.bottom);

const blueHex = "#25428f";
const redHex = "#cc0a11"

const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip");

d3.json('maps/states-albers-10m.json').then(function (us) {
    d3.csv("presidents.csv").then(function (data) {
        // console.log(data);


        function getWinningPartiesPerStatePerYear(data) {
            const winningParties = {};
            data.forEach(entry => {
                const year = entry.year;
                const state = ("0" + entry.state_fips).slice(-2);
                const state_name = entry.state;
                const party = entry.party_simplified;
                const votes = parseInt(entry.candidatevotes);
                const votePercentage = (entry.candidatevotes*100 / entry.totalvotes).toFixed(2);

                if (!winningParties[year]) {
                    winningParties[year] = {};
                }

                if (!winningParties[year][state]) {
                    winningParties[year][state] = { state_name: '', party: '', votes: 0, votePercentage: 0.0 };
                }

                if (votes > winningParties[year][state].votes && (party === 'DEMOCRAT' || party === 'REPUBLICAN')) {
                    winningParties[year][state] = { state_name, party, votes, votePercentage };
                }
            });
            return winningParties;
        }

        // Preprocess the data
        const winningParties = getWinningPartiesPerStatePerYear(data);

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
                .style('fill', d => {
                    const state = d.id;
                    const year = yearSelected;
                    const party = winningParties[year][state].party;
                    return party === 'DEMOCRAT' ? blueHex : party === 'REPUBLICAN' ? redHex : 'green';
                })
                .attr('winningParties', d => winningParties[yearSelected][d.id])
                .style('stroke-width', 0.25)
                .style('stroke', 'white');

            electionStates = chloroplethSvg.selectAll('.electionState');

            electionStates
                .on("mouseover", (event, d) => {
                    tooltip.style("opacity", 0.9);
                    tooltip.html(d.properties.name + ": " + winningParties[yearSelected][d.id].party + ", " + winningParties[yearSelected][d.id].votePercentage + "%");

                    d3.select(event.target)
                        .style('stroke-width', 0.75)
                        .style('stroke', 'black')
                        .raise();
                })
                .on("mouseout", function (event, d) {
                    tooltip.style("opacity", 0);

                    d3.select(event.target)
                        .style('stroke-width', 0.25)
                        .style('stroke', 'white');
                })
                .on("mousemove", function (event, d) {
                    tooltip.style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 28) + "px");
                })
        }
    })
})