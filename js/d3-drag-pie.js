/*
 * Author: Spencer Hedger
 * GitHub: https://github.com/spencerhedger/d3-drag-pie
 */
function d3dp() {
    function create(config) {
        var _config = config; // Keep a reference to the configuration.

        // Accessors for data values (provide some basic ones where not implemented in configuration)
        var _accessors = _config.accessors || {};
        if(!_accessors.getSegmentValue) _accessors.getSegmentValue = seg => seg.value; // Default value property.
        if(!_accessors.setSegmentValue) _accessors.setSegmentValue = (seg, value) => seg.value = value; // Default value property.
        if(!_accessors.getCategoryValue) _accessors.getCategoryValue = cat => cat.value; // Default value property.
        if(!_accessors.setCategoryValue) _accessors.setCategoryValue = (cat, value) => cat.value = value; // Default value property.
        if(!_accessors.getSegmentName) _accessors.getSegmentName = seg => seg.name; // Default name property.
        if(!_accessors.getCategoryName) _accessors.getCategoryName = cat => cat.name; // Default name property.
        if(!_accessors.sortSegments) _accessors.sortSegments = (a, b) => a.name.localeCompare(b.name); // Default is name sort.

        var _data = _config.data; // Keep a reference to the data object.
        var _chart = null; // Chart SVG object.
        var _chart_g = null; // Chart SVG g object.
        
        var _pieRadius = _config.size || 500; // Square size of chart in pixels.
        var _svgSize = _pieRadius + (_pieRadius / 5); // Add padding of 1/5.

        var _innerRadius = 0; // Inner radius size in pixels.
        var _outerRadius = _pieRadius/2; // Category data maximum value when scaled.
        var _outerBufferZone = 20; // Outer handle zone for background segment.
        var _cornerRadius = _config.cornerRadius || 0; // Segment corner radius.

        var _dragSegmentAndCategoryTogether = false; // Combined x drag segment and y drag category.
        var _isDragging = false; // Indicates true whilst segments or categories are dragged.

        // Segment colours.
        var _color = d3.scaleOrdinal().range(_config.categoryColors? _config.categoryColors : ["rgb(83, 100, 172)", "rgb(146, 157, 202)", "rgb(186, 193, 221)"]);

        // Minimal values of data for segments and categories.
        var _segmentMin = _config.segmentMinimum || 5; // Segment minimum permitted size when dragging.
        var _categoryMin = _config.categoryMinimum || 5; // Category minimum permitted size when dragging.

        // Maximal value of data for segments when dragging.
        var _segmentMax = _config.segmentMaximum || d3.max(_data, x => _accessors.getSegmentValue(x));

        // Maximal value of categories when dragging.
        var _categoryMax = _config.categoryMaximum || d3.max(_data, s => d3.max(s.categories, c => _accessors.getCategoryValue(c)));

        // Scale maximum value (default is based on _categoryMax and number of categories).
        var _categoryScaleMax = _config.categoryScaleMaximum || d3.max(_data, s => d3.max(s.categories, c => d3.max([_accessors.getCategoryValue(c), _categoryMax]) * s.categories.length));

        // Scales for segment mappings.
        var _segmentScale = d3.scaleLinear()
            .domain([0, _segmentMax]) // Input data range.
            .range([0, _outerRadius]); // Map domain onto range based on outer radius.
        
        // Scale for category mappings.
        var _categoryScale = d3.scaleLinear()
            .domain([0, _categoryScaleMax]) // Input data range.
            .range([0, _outerRadius - _outerBufferZone]); // Map domain onto range compensating for buffer zone.
        
        // Pie Segment helper.
        var pieGenerator = d3.pie()
            .value(d => _segmentScale(_accessors.getSegmentValue(d))) // Segment value.
            .sort(_accessors.sortSegments); // Apply segment sorting.
    
        // Arc calculation helper.
        var arcGenerator = d3.arc()
            .innerRadius(_innerRadius)
            .outerRadius(_outerRadius)
            .cornerRadius(_cornerRadius);

        // Initialise the chart area.
        function init() {
            // Create SVG object.
            _chart = document.createElementNS("http://www.w3.org/2000/svg", 'svg'); //Create a path in SVG's namespace
            _chart.setAttribute('width', _svgSize);
            _chart.setAttribute('height', _svgSize);

            _chart_g = document.createElementNS("http://www.w3.org/2000/svg", 'g'); //Create a path in SVG's namespace
            _chart_g.setAttribute('transform', 'translate(' + (_svgSize / (_pieRadius/_outerRadius)) + ',' +
                (_svgSize / (_pieRadius/_outerRadius)) + ')');

            _chart.appendChild(_chart_g);
            _config.target.appendChild(_chart);
        }

        // Change a segment value by specified amount.
        function shiftSegment(segment, amount) {
            if(amount == 0) return false; // Not really moving.

            // Get the value and add the amount.
            var v = _accessors.getSegmentValue(segment) + ((_config.integerValueStepping)? Math.floor(amount) : amount);

            // Check within the minimum and maximum bounds of the segment.
            if(v >= _segmentMin && v <= _segmentMax) {
                _accessors.setSegmentValue(segment, v);// Apply the value.
                return true; // Indicate successful move.
            }
            else return false; // Indicate failed to move.
        }

        // Change a category value by a specified amount.
        function shiftCategory(category, amount, parentSegment) {
            if(amount == 0) return false; // Not really moving.
            
            // Get the value and deduct the amount.
            var v = _accessors.getCategoryValue(category) - ((_config.integerValueStepping)? Math.floor(amount) : amount);

            // Prevent value becoming less than enforced minimum segment size.
            if(v >= _categoryMin && v <= _categoryMax) {
                _accessors.setCategoryValue(category, v, parentSegment); // Apply the value.
                return true; // Indicate successful move.
            }
            else return false; // Indicate failed to move.
        }

        // Handle segment dragging event.
        function segDragged(d) {
            // Try to move the segment.
            if(shiftSegment(d.data, d3.event.dx)) {
                // Fire associated config event.
                if(_config.events && _config.events.segment && _config.events.segment.drag) _config.events.segment.drag(d.data);
                
                // Redraw the chart.
                draw();
            }
        }

        // Handle category dragging event.
        function catDragged(d) {
            // Try to move the segment (if configured behaviour) and the category.
            if((_dragSegmentAndCategoryTogether && shiftSegment(d.parentSegment, d3.event.dx/2)) ||
                shiftCategory(d.category, d3.event.dy, d.parentSegment)) {
                    // Fire associated config event.
                    if(_config.events && _config.events.category && _config.events.category.drag) _config.events.category.drag(d.category, d.parentSegment);

                    // Redraw the chart.
                    draw();
                }
        }

        // Handle when dragging has begun.
        function startDragging() {
            _isDragging = true;
        }

        // Handle when dragging has ended.
        function endDragging() {
            _isDragging = false;
        }

        // Draw the chart and wire up events.
        function draw() {
            // Call optionally configured post draw event.
            if(_config.events && _config.events.startRedraw) _config.events.startRedraw(_data);

            var arcData = pieGenerator(_data);

            // Select.
            var n = d3.select(_chart_g)
                .selectAll('path')
                .data(arcData);

            // Enter.
            var nEnter = n.enter()
                .append('path')
                .attr('d', arcGenerator)
                .attr('id', (d,i) => 'd3dp-segment' + i)
                .attr('class', d => 'd3dp-segment')

            if(_config.segmentsDraggable) { // Enable dragging segments.
                nEnter
                    .style('cursor', 'ew-resize')
                    .call(d3.drag()
                        .on('start', startDragging)
                        .on('drag', segDragged)
                        .on('end', endDragging)
                    );
            }
            
            //Append the label names (if configured).
            if(_config.showSegmentLabels) {
                d3.select(_chart_g)
                    .selectAll('.segmentTextLabel')
                    .data(arcData)
                    .enter().append('text')
                    .attr('class', 'd3dp-segment-text-label')
                    .attr('style', 'font-size: 13px;')
                    .attr('dy', 15)
                    .attr('dx', 5)
                    .append('textPath')
                    .attr('xlink:href', (d,i) => '#d3dp-segment' + i)
                    .text(d => d.data.name);
            }

            // Wire up external configured event function calls.
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
                var seg = arcData[i]; // Get the segment data.

                // Add categories, if they exist.
                if(seg.data.categories) {
                    var catPaths = []; // Array to hold category data.

                    // Create the arc for basis of categories in the segment.
                    var catArc = d3.arc()
                        .startAngle(seg.startAngle)
                        .endAngle(seg.endAngle)
                        .innerRadius(_innerRadius);

                    var runningTotal = 0; // Used when stacking categories.

                    for(var j = 0; j < seg.data.categories.length; j++) {
                        // Get the value for this category.
                        var v = _accessors.getCategoryValue(seg.data.categories[j]);

                        // Create a data object.
                        catPaths.push({
                            index: j, // Maintain a record of original order.
                            category: seg.data.categories[j], // Category object for data.
                            parentSegment: seg.data, // Reference to segment that this category is in.
                            path: catArc({ outerRadius: _innerRadius + _categoryScale(v + ((_config.categoryStacking)? runningTotal : 0)) }) // Arc for the segment.
                        });

                        runningTotal += v; // Add value to the running total.
                    }

                    // Sort by descending size so smaller ones are not hidden by bigger ones.
                    if(!_config.categoryStacking) catPaths.sort((a, b) => d3.descending(_accessors.getCategoryValue(a.category), _accessors.getCategoryValue(b.category)));
                    else catPaths.sort((a, b) => d3.descending(a.index, b.index)); // Sort descending on the original category index so stacking is layered correctly.

                    // Select.
                    var c = d3.select(_chart_g)
                        .selectAll('.d3dp-segment-category' + i)
                        .data(catPaths);
                    
                    // Enter.
                    var cEnter = c.enter()
                        .append('path')
                        .attr('d', x => x.path)
                        .attr("id", (d,j) => 'd3dp-segment' + i + '-category' + j)
                        .attr('class', 'd3dp-segment-category d3dp-segment-category' + i)
                        .style('fill', x => _color(x.index))

                    // Enable dragging (if configured).
                    if(_config.categoriesDraggable) {
                        cEnter
                            .style('cursor', 'ns-resize')
                            .call(d3.drag()
                                .on('start', startDragging)
                                .on('drag', catDragged)
                                .on('end', endDragging)
                            );
                    }

                    // Wire up external configured event function calls.
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
            }

            // Call optionally configured post draw event.
            if(_config.events && _config.events.endRedraw) _config.events.endRedraw(_data, _chart);

            return _chart; // Reference to the chart that has just been created.
        }

        // Initialise the chart.
        init();
        draw();

        // Object to provide external functionality.
        return {
            refresh: draw // Update chart when data values change externally.
        };
    }

    return {
        create: create // Create new chart.
    }
}