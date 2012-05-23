
/**
 * BoxplotChart is the main class for generating... categorical boxplotcharts.
 * 
 * The boxplot is used to represent the distribution of data using:
 *  - a box to represent the region that contains 50% of the datapoints,
 *  - the whiskers to represent the regions that contains 95% of the datapoints, and
 *  - a center line (in the box) that represents the median of the dataset.
 * For more information on boxplots you can visit  http://en.wikipedia.org/wiki/Box_plot
 *
 * If you have an issue or suggestions regarding the ccc BoxPlot-charts
 * please contact CvK at cde@vinzi.nl
 */
pvc.BoxplotChart = pvc.CategoricalAbstract.extend({

    constructor: function(options){

        this.base(options);

        // Apply options
        pvc.mergeDefaults(this.options, pvc.BoxplotChart.defaultOptions, options);

        //this._axisRoleNameMap.ortho = 'median';

        // This categorical chart does not support selection, yet
        this.options.selectable = false;
    },

    /**
     * Prevents creation of the series role by the cartesian charts base class.
     */
    _getSeriesRoleSpec: function(){
        return null;
    },

    /**
     * Initializes each chart's specific roles.
     * @override
     */
    _initVisualRoles: function(){

        this.base();

        /*
         * Inherited 'category' role.
         *
         * Then:
         * 1) value(_percentil50), (Median)
         *
         * 2) value_percentil25, (25% percentil)
         * 3) value_percentil75, (75% percentil)
         * 4) value_percentil5,  (5% percentil)
         * 5) value_percentil95  (95% percentil)
         *
         */
    },

    /* @override */
    _createMainContentPanel: function(parentPanel){
        if(pvc.debug >= 3){
            pvc.log("Prerendering in boxplotChart");
        }
        
        var options = this.options;
        return new pvc.BoxplotChartPanel(this, parentPanel, {
            panelSizeRatio: options.panelSizeRatio,
            boxSizeRatio:   options.boxSizeRatio,
            showValues:     options.showValues,
            orientation:    options.orientation,
            // boxplot specific options
            boxplotColor:   options.boxplotColor
        });
    }
}, {
    defaultOptions: {
        showValues:   true,
        boxplotColor: "darkgreen"  // "gray"
    }
});

/*
 * Boxplot chart panel generates the actual box-plot with a categorical base-axis.
 * for more information on the options see the documentation file.
 */
pvc.BoxplotChartPanel = pvc.CartesianAbstractPanel.extend({
    anchor: 'fill',
    pvBox: null,
    pvBoxLabel: null,

    boxSizeRatio: 0.5,
    boxplotColor: "grey",
    
    showValues: true,

    hRules: null,
    vRules: null,
    bars: null,

    /**
     * @override
     */
    _createCore: function(){
        this.base();
        
        var myself = this,
            options = this.chart.options,
            data = this.chart.data;

        this.hRules = [];
        this.vRules = [];
        this.bars = [];

        var anchor = this.isOrientationVertical() ? "bottom" : "left";

        // prepare data and functions when creating (rendering) the chart.
        this.prepareDataFunctions();

        this.generateBoxPlots();

        // define a panel for each category label.
        // later the individuals bars of series will be drawn in
        // these panels.
        this.pvBoxPanel = this.pvPanel.add(pv.Panel);

        // add the box-plots to the chart
        this.pvBar = this.pvBoxPanel.add(pv.Bar)
            .data(this.bars)
            .left(function(d) { return d.left; })
            .width( function(d) { return d.width; })
            .height( function(d) { return d.height; })
            .bottom( function(d) { return d.bottom; })
            .fillStyle( function(d) { return d.fillStyle; });

        this.pvBoxPanel.add(pv.Rule)
            .data(this.hRules)
            .left(function(d) { return d.left; })
            .width( function(d) { return d.width; })
            .bottom( function(d) { return d.bottom; })
            .lineWidth( function(d) { return d.lWidth; })
            .strokeStyle(options.boxplotColor);

        this.pvBoxPanel.add(pv.Rule)
            .data(this.vRules)
            .left(function(d) { return d.left; })
            .height( function(d) { return d.height; })
            .bottom( function(d) { return d.bottom; })
            .lineWidth( function(d) { return d.lWidth; })
            .strokeStyle(options.boxplotColor);

        if(options.secondAxis){
            var timeSeries = options.timeSeries,
                parser = timeSeries ? 
                            pv.Format.date(options.timeSeriesFormat) :
                            null;

            // Second axis - support for lines
            this.pvSecondLine = this.pvPanel.add(pv.Line)
                .data(function(d){
                    return data.getObjectsForSecondAxis(d,
                        timeSeries ?
                            function(a,b){
                                return parser.parse(a.category) - parser.parse(b.category);
                            } : 
                            null);
                    })
                .strokeStyle(function(){
                    var cols = options.secondAxisColor;
                    cols = cols instanceof Array ? cols : [cols];
                    return cols[this.parent.index % cols.length];
                })
                [pvc.BasePanel.relativeAnchor[anchor]](myself.DF.secBasePosFunc)
                [anchor](myself.DF.secOrthoLengthFunc);

            this.pvSecondDot = this.pvSecondLine.add(pv.Dot)
                .shapeSize(8)
                .lineWidth(1.5)
                .fillStyle(function(){
                    var cols = options.secondAxisColor;
                    cols = cols instanceof Array ? cols : [cols];
                    return cols[this.parent.index % cols.length];
                });
        }

        // add Labels:
        this.pvBar
            .text(function(d){
                var s = data.getVisibleSeries()[this.parent.index];
                var c = data.getVisibleCategories()[this.index];
                
                return options.v1StyleTooltipFormat.call(myself,s,c,d.value);
            });

        if(options.showTooltips){
            this.pvBar.
                event("mouseover", pv.Behavior.tipsy(options.tipsySettings));
        }


        if (this._shouldHandleClick()){
            this.pvBar
                .cursor("pointer")
                .event("click", function(d){
                    var s = data.getVisibleSeries()[this.parent.index];
                    var c = data.getVisibleCategories()[this.index];

                    var ev = arguments[arguments.length-1];
                    return options.clickAction(s,c, d.value, ev);
                });
        }
    },

    /**
     * @override
     */
    applyExtensions: function(){

        this.base();

        // Extend bar and barPanel
        this.extend(this.pvBoxPanel,"boxPanel_");
        this.extend(this.pvBoxPanel,"box_");
    },

    /*
     *   This function implements a number of helper functions in order
     *   to increase the readibily and extendibility of the code by:
     *    1: providing symbolic names (abstractions) to the numerous anonymous
     *        functions that need to be passed to Protovis
     *    2: by moving large parts of the local variabele (parameters
     *       and scaling functions out of the 'create' function to this
     *       prepareDataFunctions blok.
     *
     *   These helper functions (closures) are all stored in 'this.DF'
     *
     *   Overriding this 'prepareDataFunctions' allows you to implement
     *   a different ScatterScart, however, it is also possible to
     *   replace specific functions from the 'this.DF' object.
     *
     *   Currently I still use a separate chart-type for waterfall/bar plots
     *   and for box-plots.
     */
    prepareDataFunctions:  function() {
        var myself = this,
            chart = this.chart,
            options = chart.options;

        // create empty container for the functions and data
        this.DF = {};

        var lScale  = chart.axes.ortho.scale;
        var oScale  = chart.axes.base.scale;

        /*
         * fuctions to determine positions along base axis.
         */
	// find the left side of the container
        this.DF.catContainerBasePosFunc = oScale;

        this.DF.catContainerWidth = oScale.range().band;

	// find the relative position within this container

        if(options.timeSeries){
            var parser = pv.Format.date(options.timeSeriesFormat);

            this.DF.secBasePosFunc =
                function(d){
                    return tScale(parser.parse(d.category));
                };
        } else {
            this.DF.secBasePosFunc =
                function(d){
                    return oScale(d.category);
                };
        }
        
        /*
         * functions to determine positions along orthogonal axis
         */
        this.DF.orthoLengthFunc = function(d){
            return lScale(d);
        };

        if(options.secondAxis){
            var l2Scale = chart.getSecondScale();
            this.DF.secOrthoLengthFunc = function(d){
                return myself.chart.animate(0,l2Scale(d.value));
            };
        }
    },

    generateBoxPlots: function() {
        var data = this.chart.data;
        var categories = data.getVisibleCategories();
        //var visibleSeries = data.getVisibleSeries();
        var values = data.getValues();

        var lwa = 2;   // lineWidth of average.

        // store the index of the different values
        var median = 0,
            p25 = 1,
            p75 = 2,
            p5  = 3,
            p95 = 4;

        // boxplot covers third of width of container
        var widthBox = this.DF.catContainerWidth/3,
            widthBox2 = widthBox/2;
        
        // to do: adjust for max-width and minWidth
        var leftOffset = (this.DF.catContainerWidth - widthBox)/2;

        for(var index = 0; index < categories.length; index++) {
            // order the data elements from 5% bound to 95% bound
            // and determine the horizontal scale
            var valuesRow = values[index],
                dat = valuesRow.map(this.DF.orthoLengthFunc);

            var midBox   = this.DF.catContainerBasePosFunc(index),
                leftBox  = midBox - widthBox2,
                rightBox = midBox + widthBox2;

            this.vRules.push({
                    "left": midBox,
                    "height": dat[p25] - dat[p5],
                    "lWidth": 1,
                    "bottom": dat[p5]
                });

            this.vRules.push({
                    "left":   leftBox,
                    "height": dat[p75] - dat[p25],
                    "lWidth": 1,
                    "bottom": dat[p25]
                });

            this.vRules.push({
                    "left":   rightBox,
                    "height": dat[p75] - dat[p25],
                    "lWidth": 1,
                    "bottom": dat[p25]
                });

            this.vRules.push({
                    "left": midBox,
                    "height": dat[p95] - dat[p75],
                    "lWidth": 1,
                    "bottom": dat[p75]
                });
            
            for(var i=0; i< dat.length; i++){
                this.hRules.push({
                    "left":   leftBox,
                    "bottom": dat[i],
                    "lWidth": (i == median) ? lwa : 1,
                    "width":  widthBox
                });
            }
            
            this.bars.push({
                "value":     valuesRow[median],
                "left":      leftBox,
                "bottom":    dat[p25],
                "width":     widthBox,
                "height":    dat[p75]-dat[p25],
                "fillStyle": "limegreen"
            });
          }
    }
});
