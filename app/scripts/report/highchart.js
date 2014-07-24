define([
    'base/muceCom'
], function(MuceCom) {
    // Fuck. date format(humanable, or timestamp etc)
    var buildLineChart = function(currentReport, data) {
        $('#chart_canvas').html('');
        var uniqCate = _.uniq(_.pluck(currentReport.metrics, 'type'));
        var isMutipleY = currentReport.metrics.length > 1 && uniqCate.length > 1;

        function formatTip() {
            var periodFormatMap = {
                0: '%A %Y-%m-%e:%H', // hour
                1: '%A %Y-%m-%e', // day
                week: '%A %Y-%m-%e',
                month: '%Y-%m'
            };

            function getAnnotationStr(point) {
                var retStr, date, metric;
                _.each(data.annotations, function(item) {
                    date = MuceCom.getUTCDateByDateAndPeriod(item.xAxis + '');
                    metric = _.find(currentReport.metrics, function(m) {
                        return m.id == item.metric;
                    });
                    if (!metric) return null;
                    if (point.series.name === metric.name && point.x === date) {
                        retStr = item.user + ': ' + item.comment + '<br/>Create Time: ' + Highcharts.dateFormat('%A %Y-%m-%e', item.createTime);
                    }
                });
                return retStr;
            }

            var s = '<b>' + Highcharts.dateFormat(periodFormatMap[data.period], this.x) + '</b>';

            // Todo: with template to build str
            // Todo: batch points or single tooltip (shared or not)
            // Todo: rearrange by number size(for normal visual)
            $.each(this.points, function(i, point) {
                s += '<br/><p style="color: ' + point.series.color + '">' + point.series.name + ': ' +
                    point.y;
                s += getAnnotationStr(point) ? '<br/>' + getAnnotationStr(point) + '</p>' : '</p>';
            });

            return s;
        }

        function getSeries() {
            var retData = []
            if (data.result && data.result.length) {
                var annotationPoints = [];
                _.each(currentReport.metrics, function(item, index) {
                    var detailData = {};
                    detailData = {
                        name: item.name,
                        data: [],
                        id: item.id,
                        pointStart: MuceCom.getUTCDateByDateAndPeriod(data.result[0].date, data.period),
                        pointInterval: MuceCom.getIntervalByPeriod(data.period)
                    };
                    if (isMutipleY && item.type === 'percent') {
                        detailData.yAxis = 1;
                    }
                    retData.push(detailData);

                    var annotationArray = _.filter(data.annotations, function(ann) {
                        return ann.metric == item.id;
                    });
                    _.each(annotationArray, function(annotation) {
                        var annotationPoint = {};
                        annotationPoint.metricIndex = index;
                        annotationPoint.index = (MuceCom.getUTCDateByDateAndPeriod(annotation.xAxis, data.period) - detailData.pointStart) / detailData.pointInterval;
                        annotationPoint.id = annotation.id;
                        annotationPoints.push(annotationPoint);
                    });

                });

                _.each(retData, function(item, metricIndex) {
                    var tmp = _.pluck(data.result, item.id);
                    _.each(tmp, function(num, index) {
                        if (!num) {
                            num = 0;
                        }
                        var d = Number(num);

                        var hasAnnotation = _.find(annotationPoints, function(annotation) {
                            return metricIndex === annotation.metricIndex && index === annotation.index;
                        });
                        if (hasAnnotation) {
                            var d = {};
                            d.y = Number(num);
                            d.marker = {
                                symbol: 'url(http://muce.corp.wandoujia.com/images/flag.png?id=' + hasAnnotation.id + ')'
                            };
                        }

                        item.data.push(d);
                    })
                });
            }

            return retData;
        }

        function getYAxis() {
            var yAxisMap = [
                [{
                    title: {
                        text: ''
                    }
                }, {
                    title: {
                        text: ''
                    },
                    opposite: true
                }], {
                    title: {
                        text: ''
                    },
                    plotLines: [{
                        value: 0,
                        width: 1,
                        color: '#808080'
                    }]
                }
            ];
            return isMutipleY ? yAxisMap[0] : yAxisMap[1];
        }

        function addAnotation(event) {
            $('.annotation-container').remove();
            var annotationId; // Todo: fix annotation edit(not found?!)
            if (event.point.marker) {
                var symbol = event.point.marker.symbol;
                var matchAry = symbol.match(/\?id=(\d+)/);
                if (matchAry) {
                    annotationId = matchAry[1];
                }
            }

            var container = $('<div/>').addClass('annotation-container alert fade in')
                .css({
                    left: event.point.pageX,
                    top: event.point.pageY
                });
            var heading = $('<h4/>').addClass('alert-heading')
                .append(this.name);
            var closeBtn = $('<button/>').addClass('close')
                .attr('data-dismiss', 'alert')
                .append('x');

            var textarea = $('<textarea/>').addClass('textarea');
            var saveBtn = $('<button/>').addClass('save btn')
                .append('Save');
            var deleteBtn = $('<a/>')
                .addClass('delete')
                .append('Delete');

            if (annotationId) {
                var annotationInfo = _.find(data.annotations, function(item) {
                    return item.id == annotationId;
                });
                textarea.val(annotationInfo.comment);
                deleteBtn.show();
            } else {
                deleteBtn.hide();
                textarea.val('');
            }

            container.append(closeBtn)
                .append(heading)
                .append(textarea)
                .append(deleteBtn)
                .append(saveBtn);

            $(document.body).append(container);

            saveBtn.on('click', function() {
                // Todo
                var data = {
                    metric: _.find(currentReport.metrics, function(item) {
                        return item.name === this.name;
                    }.bind(this)).id,
                    x_axis: Highcharts.dateFormat('%Y%m%d%H', event.point.x),
                    period: MuceCom.getCurrentPeriod(),
                    filters: undefined, // MuceCom.stringifyObj(currentData.table_filters)
                    user: MuceCom.getNameFromCookie(),
                    comment: $('.annotation-container .textarea').val(),
                    type: 'put'
                };
                if (annotationId) {
                    data.id = annotationId;
                    data.type = 'post';
                }
                // apiHelper('addAnnotation', data).then(function() {$('.annotation-container').alert('close');})
            }.bind(this));
        }

        var chartOptions = {
            chart: {
                renderTo: 'chart_canvas',
                type: 'line',
                zoomType: 'x',
                marginRight: 50,
                events: {
                    click: function(event) {
                        // 清理 annotation click popover
                        $('.annotation-container').alert('close');
                    }
                }
            },
            credits: {
                enabled: false
            },
            title: {
                text: '',
                x: -20
            },
            subtitle: {
                text: '',
                x: -20
            },
            xAxis: {
                type: 'datetime'
            },
            yAxis: getYAxis(),
            tooltip: {
                formatter: formatTip,
                shared: true,
                crosshairs: true
            },
            plotOptions: {
                series: {
                    cursor: 'pointer',
                    events: {
                        click: addAnotation
                    }
                }
            },
            series: getSeries()
        };

        return new Highcharts.Chart(chartOptions);
    };

    return {
        buildLineChart: buildLineChart
    };
});