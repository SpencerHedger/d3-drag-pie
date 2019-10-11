/*
 * Author: Spencer Hedger
 * GitHub: https://github.com/spencerhedger/d3-drag-pie
 */
function d3dp() {
    function create(config) {
        var _config = config; // Keep a reference to the configuration.

        // Accessors for data values (provide some basic ones where not implemented in configuration)
        var _accessors = _config.accessors || {};
        if(!_accessors.getSegmentValue) _accessors.getSegmentValue = seg => seg.value;
        if(!_accessors.setSegmentValue) _accessors.setSegmentValue = (seg, value) => seg.value = value;
        if(!_accessors.getCategoryValue) _accessors.getCategoryValue = cat => cat.value;
        if(!_accessors.setCategoryValue) _accessors.setCategoryValue = (cat, value) => cat.value = value;
        if(!_accessors.getSegmentName) _accessors.getSegmentName = seg => seg.name;
        if(!_accessors.getCategoryName) _accessors.getCategoryName = cat => cat.name;
        if(!_accessors.sortSegments) _accessors.sortSegments = (a, b) => a.name.localeCompare(b.name);

        var _data = _config.data; // Keep a reference to the data object.
        var _chart = null;
        var _chart_g = null;
        
        var _pieRadius = 500;

        var _innerRadius = 0;
        var _outerRadius = 100; // Category data maximum value when scaled.
        var _outerBufferZone = 10; // Outer handle zone for background segment.
        var _cornerRadius = _config.cornerRadius || 0;

        var _segmentDragMin = 5; // Segment minimum permitted size when dragging.
        var _categoryDragMin = 5; // Category minimum permitted size when dragging.

        var _dragSegmentAndCategoryTogether = false; // Combined x drag segment and y drag category.
        var _isDragging = false; // Indicates true whilst segments or categories are dragged.

        var _color = d3.scaleOrdinal()
            .range(config.categoryColors);

        // Initial maximal values of data for segments and categories.
        var _segmentScaleMax = _config.segmentScaleMaximum || d3.max(_data, x => _accessors.getSegmentValue(x));
        var _categoryScaleMax = _config.categoryScaleMaximum || d3.max(_data, s => d3.max(s.categories, c => _accessors.getCategoryValue(c)));

        // Scales for segment mappings.
        var _segmentScale = d3.scaleLinear()
            .domain([0, _segmentScaleMax]) // Input data range.
            .range([0, 100]);
        
        // Scale for category mappings.
        var _categoryScale = d3.scaleLinear()
            .domain([0, _categoryScaleMax])
            .range([0, _outerRadius - _outerBufferZone]);
        
        // Pie Segment helper.
        var pieGenerator = d3.pie()
            .value(d => _segmentScale(_accessors.getSegmentValue(d)))
            .sort(_accessors.sortSegments);
    
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
            _config.target.appendChild(_chart);
        }

        function shiftSegment(segment, amount, scale) {
            if(amount == 0) return false;
            var v = _accessors.getSegmentValue(segment) + amount;

            if(scale(v) > _segmentDragMin) {
                _accessors.setSegmentValue(segment, v);
                return true;
            }
            else return false;
        }

        function shiftCategory(category, amount, scale, parentSegment) {
            if(amount == 0) return false;
            var v = _accessors.getCategoryValue(category) - amount;

            // Prevent value becoming less than enforced minimum segment size.
            if(scale(v) > _categoryDragMin && scale(v) < _outerRadius - _outerBufferZone) {
                _accessors.setCategoryValue(category, v, parentSegment);
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
                shiftCategory(d.category, d3.event.dy, _categoryScale, d.parentSegment)) {
                    if(_config.events && _config.events.category && _config.events.category.drag) _config.events.category.drag(d.category, d.parentSegment);
                    draw();
                }
        }

        function startDragging() {
            _isDragging = true;
        }

        function endDragging() {
            _isDragging = false;
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
                .attr('class', (d,i) => 'd3dp-segment d3dp-segment' + i)
                .call(d3.drag()
                    .on('start', startDragging)
                    .on('drag', segDragged)
                    .on('end', endDragging)
                    );
            
            if(_config.events && _config.events.segment) {
                if(_config.events.segment.mouseover) nEnter.on('mouseover', function(d) { if(!_isDragging) _config.events.segment.mouseover(d.data) })
                if(_config.events.segment.mouseout) nEnter.on('mouseout', function(d) { if(!_isDragging) _config.events.segment.mouseout(d.data) })
                if(_config.events.segment.click) nEnter.on('click', function(d) { if(!_isDragging) _config.events.segment.click(d.data) });
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
                        path: catArc({ outerRadius: _innerRadius + _categoryScale(_accessors.getCategoryValue(seg.data.categories[j])) })
                    });
                }

                // Sort by descending size so smaller ones are not hidden by bigger ones.
                catPaths.sort((a, b) => d3.descending(_accessors.getCategoryValue(a.category), _accessors.getCategoryValue(b.category)));

                // Select.
                var c = d3.select(_chart_g)
                    .selectAll('.d3dp-segment-category' + i)
                    .data(catPaths);
                
                // Enter.
                var cEnter = c.enter()
                    .append('path')
                    .attr('d', x => x.path)
                    .attr('class', 'd3dp-segment-categories d3dp-segment-category' + i)
                    .style('fill', x => _color(x.category.id))
                    .call(d3.drag()
                            .on('start', startDragging)
                            .on('drag', catDragged)
                            .on('end', endDragging)
                        );

                if(_config.events && _config.events.category) {
                    if(_config.events.category.mouseover) cEnter.on('mouseover', function(d) { if(!_isDragging) _config.events.category.mouseover(d.category, d.parentSegment) })
                    if(_config.events.category.mouseout) cEnter.on('mouseout', function(d) { if(!_isDragging) _config.events.category.mouseout(d.category, d.parentSegment) })
                    if(_config.events.category.click) cEnter.on('click', function(d) { if(!_isDragging) _config.events.category.click(d.category, d.parentSegment) });
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