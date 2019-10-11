function d3dp(config) {
    function create(data, domTarget) {
        var _data = data;
        var _chart = null;
        var _chart_g = null;

        var _innerRadius = 0;
        var _outerRadius = 100;
        var _cornerRadius = 5;

        var _segmentDragMin = 5;
        var _categoryDragMin = 5;

        var _color = d3.scaleOrdinal()
            .range(config.categoryColors);

        // Pie Segment helper.
        var pieGenerator = d3.pie()
            .value(d => d.value)
            .sort((a, b) => a.name.localeCompare(b.name));
    
        // Arc calculation helper.
        var arcGenerator = d3.arc()
            .innerRadius(_innerRadius)
            .outerRadius(_outerRadius)
            .cornerRadius(_cornerRadius);

        function init() {
            // Create SVG object.
            _chart = document.createElementNS("http://www.w3.org/2000/svg", 'svg'); //Create a path in SVG's namespace
            _chart.setAttribute('width', '500');
            _chart.setAttribute('height', '500');

            _chart_g = document.createElementNS("http://www.w3.org/2000/svg", 'g'); //Create a path in SVG's namespace
            _chart_g.setAttribute('transform', 'translate(150,250)');

            _chart.appendChild(_chart_g);
            domTarget.appendChild(_chart);
        }

        function segDragged(d) {
            var dx = d3.event.dx;
            var dy = d3.event.dy;
            d.data.value += dx;
            
            // Prevent value becoming less than enforced minimum segment size.
            if(d.data.value < _segmentDragMin) d.data.value = _segmentDragMin;

            draw();
        }

        function catDragged(d) {
            var dx = d3.event.dx;
            var dy = d3.event.dy;
            d.category.value += dx;
            
            // Prevent value becoming less than enforced minimum segment size.
            if(d.category.value < _segmentDragMin) d.category.value = _categoryDragMin;
            else if(d.category.value > _outerRadius) d.category.value = _outerRadius;

            draw();
        }

        function draw() {
            var arcData = pieGenerator(_data);

            // Select.
            var n = d3.select(_chart_g)
                .selectAll('path')
                .data(arcData);

            // Enter.
            n.enter()
                .append('path')
                .attr('d', arcGenerator)
                .call(d3.drag().on("drag", segDragged));
            
            // Update.
            n.attr('d', arcGenerator);

            // Exit.
            n.exit().remove();

            // Categories in segments
            for(var i = 0; i < arcData.length; i++) {
                var seg = arcData[i];
                var catPaths = [];

                var catArc = d3.arc()
                    .startAngle(seg.startAngle)
                    .endAngle(seg.endAngle)
                    .innerRadius(_innerRadius);

                for(var j = 0; j < seg.data.categories.length; j++) {
                    catPaths.push({
                        category: seg.data.categories[j],
                        path: catArc({ outerRadius: _innerRadius + seg.data.categories[j].value })
                    });
                }

                // Sort by descending size so smaller ones are not hidden by bigger ones.
                catPaths.sort((a, b) => d3.descending(a.category.value, b.category.value));

                // Select.
                var c = d3.select(_chart_g)
                    .selectAll('.segcats' + i)
                    .data(catPaths);
                
                // Enter.
                c.enter()
                    .append('path')
                    .attr('d', x => x.path)
                    .attr('class', 'segcats' + i)
                    .style('fill', (x) => _color(x.category.id))
                    .call(d3.drag().on("drag", catDragged));

                // Update.
                c.attr('d', x => x.path);

                // Exit.
                c.exit().remove();
            }

            return _chart;
        }

        // Initial display.
        init();
        draw();

        // Object to provide external functionality.
        return {
            refresh: draw
        };
    }

    return {
        create: create
    }
}