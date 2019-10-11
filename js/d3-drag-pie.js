function d3dp(config) {
    var _config = config;

    function create(data, domTarget) {
        var _data = data;
        var _chart = null;
        var _chart_g = null;
        
        var _pieRadius = 500;

        var _innerRadius = 0;
        var _outerRadius = 100; // Category data maximum value.
        var _outerBufferZone = 10; // Outer handle zone for background segment.
        var _cornerRadius = 5;

        var _segmentDragMin = 5; // Segment minimum permitted size when dragging.
        var _categoryDragMin = 5; // Category minimum permitted size when dragging.

        var _dragSegmentAndCategoryTogether = false; // Combined x drag segment and y drag category.

        var _color = d3.scaleOrdinal()
            .range(config.categoryColors);

        // Scales for segment mappings.
        var _segmentScale = d3.scaleLinear()
            .domain([0, d3.max(_data, x => x.value)]) // Input data range.
            .range([0, 100]);
        
        // Scale for category mappings.
        var _categoryScale = d3.scaleLinear()
            .domain([0, d3.max(_data, s => d3.max(s.categories, c => c.value))])
            .range([0, _outerRadius - _outerBufferZone]);
        
        // Pie Segment helper.
        var pieGenerator = d3.pie()
            .value(d => _segmentScale(d.value))
            .sort((a, b) => a.name.localeCompare(b.name));
    
        // Arc calculation helper.
        var arcGenerator = d3.arc()
            .innerRadius(_innerRadius)
            .outerRadius(_outerRadius)
            .cornerRadius(_cornerRadius);

        function init() {
            // Create SVG object.
            _chart = document.createElementNS("http://www.w3.org/2000/svg", 'svg'); //Create a path in SVG's namespace
            _chart.setAttribute('width', _pieRadius);
            _chart.setAttribute('height', _pieRadius);

            _chart_g = document.createElementNS("http://www.w3.org/2000/svg", 'g'); //Create a path in SVG's namespace
            _chart_g.setAttribute('transform', 'scale(' +
                ((_pieRadius / _outerRadius)/2) +
                ') translate(' + (_pieRadius / (_pieRadius/_outerRadius)) + ',' +
                (_pieRadius / (_pieRadius/_outerRadius)) + ')');

            _chart.appendChild(_chart_g);
            domTarget.appendChild(_chart);
        }

        function shiftSegment(segment, amount, scale) {
            if(amount == 0) return false;
            var v = segment.value + amount;

            if(scale(v) > _segmentDragMin) {
                segment.value = v;
                return true;
            }
            else return false;
        }

        function shiftCategory(category, amount, scale) {
            if(amount == 0) return false;
            var v = category.value - amount;

            // Prevent value becoming less than enforced minimum segment size.
            if(scale(v) > _categoryDragMin && scale(v) < _outerRadius - _outerBufferZone) {
                category.value = v;
                return true;
            }
            else return false;
        }

        function segDragged(d) {
            if(shiftSegment(d.data, d3.event.dx, _segmentScale)) {
                if(_config.events && _config.events.segment && _config.events.segment.drag) _config.events.segment.drag(d.data);
                draw();
            }
        }

        function catDragged(d) {
            if((_dragSegmentAndCategoryTogether && shiftSegment(d.parentSegment, d3.event.dx/2, _segmentScale)) ||
                shiftCategory(d.category, d3.event.dy, _categoryScale)) {
                    if(_config.events && _config.events.category && _config.events.category.drag) _config.events.category.drag(d.category, d.parentSegment);
                    draw();
                }
        }

        function draw() {
            var arcData = pieGenerator(_data);

            // Select.
            var n = d3.select(_chart_g)
                .selectAll('path')
                .data(arcData);

            // Enter.
            var nEnter = n.enter()
                .append('path')
                .attr('d', arcGenerator)
                .call(d3.drag().on("drag", segDragged));
            
            if(_config.events && _config.events.segment) {
                if(_config.events.segment.mouseover) nEnter.on('mouseover', d => _config.events.segment.mouseover(d.data))
                if(_config.events.segment.mouseout) nEnter.on('mouseout', d => _config.events.segment.mouseout(d.data))
                if(_config.events.segment.click) nEnter.on('click', d => _config.events.segment.click(d.data));
            }

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
                        parentSegment: seg.data,
                        path: catArc({ outerRadius: _innerRadius + _categoryScale(seg.data.categories[j].value) })
                    });
                }

                // Sort by descending size so smaller ones are not hidden by bigger ones.
                catPaths.sort((a, b) => d3.descending(a.category.value, b.category.value));

                // Select.
                var c = d3.select(_chart_g)
                    .selectAll('.segcats' + i)
                    .data(catPaths);
                
                // Enter.
                var cEnter = c.enter()
                    .append('path')
                    .attr('d', x => x.path)
                    .attr('class', 'segcats' + i)
                    .style('fill', x => _color(x.category.id))
                    .call(d3.drag().on("drag", catDragged));

                if(_config.events && _config.events.category) {
                    if(_config.events.category.mouseover) cEnter.on('mouseover', d => _config.events.category.mouseover(d.category, d.parentSegment))
                    if(_config.events.category.mouseout) cEnter.on('mouseout', d => _config.events.category.mouseout(d.category, d.parentSegment))
                    if(_config.events.category.click) cEnter.on('click', d => _config.events.category.click(d.category, d.parentSegment));
                }

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