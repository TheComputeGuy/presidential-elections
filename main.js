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

        // ------------------- Chloropleth -------------------

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
            return (votes_sorted[0] - votes_sorted[1])/v[0].totalvotes;
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

                winningParties[year_][state_fip].winningPercentage = (stateEntry[1]*100).toFixed(2);
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
    })
})