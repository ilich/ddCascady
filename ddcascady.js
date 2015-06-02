(function ($) {
    
    $.fn.ddCascady = function (options) {
        var settings = $.extend({
            service: null,
            method: "POST",
            firstElementOrderNumber: 0
        }, options);

        if (typeof settings.service !== "string" || settings.service === "") {
            throw new Error("Ajax service has to be provided");
        }

        function createOption(text, value) {
            var option = document.createElement("option");
            option.text = text;
            option.value = value;
            return option;
        }

        var controls = {
            elements: [],   // We store orders (ID's in this array to speed up the search)
            findAllAfter: function (order) {
                return this.elements.filter(function (el, idx, array) {
                    return el > order;
                });
            },
            findFirstAfter: function (order) {
                var allAfter = this.findAllAfter(order);
                return Math.min.apply(window, allAfter);
            }
        }

        return this.each(function () {
            var $this = $(this),
                order = $this.data("order"),
                isRoot = order === settings.firstElementOrderNumber;

            // Cleanup all drop down's except the root one

            if (!isRoot) {
                $this.empty();
            }

            // Register drop down metadata

            if (controls.hasOwnProperty(order)) {
                throw new Error("You cannot have multiple drop down's with order " + order);
            }

            controls[order] = {
                $element: $this,
                element: this,
                json: $this.data("json"),
                text: $this.data("option-text"),
                value: $this.data("option-value")
            };

            controls.elements.push(order);

            // Query web-service when user changes selection

            $this.change(function () {

                // Clean up drop down elements

                var subs = controls.findAllAfter(order);
                for (var i = 0; i < subs.length; i++) {
                    var sub = subs[i];
                    controls[sub].$element.empty();
                }

                // Prepare query to the service

                var query = {};
                for (var i = 0; i < controls.elements.length; i++) {
                    var elId = controls.elements[i],
                        el = controls[elId].element;

                    if (el.selectedIndex > -1) {
                        query[el.name] = el.options[el.selectedIndex].value;
                    }
                }

                // Query the service and fill drop down elements

                $.ajax(settings.service, {
                    data: query,
                    dataType: "json",
                    method: settings.method
                }).done(function (data) {

                    var firstSub = controls.findFirstAfter(order);
                    var sub = controls[firstSub];

                    if (!data.hasOwnProperty(sub.json)) {
                        throw new Error(sub.json + " is not found in service response");
                    }

                    var el = sub.element;
                    var items = data[sub.json];

                    var emptyOption = createOption("", "");
                    el.options.add(emptyOption);

                    for (var i = 0; i < items.length; i++) {
                        var option = createOption(items[i][sub.text], items[i][sub.value]);
                        el.options.add(option);
                    }

                });
            });
        });
    };

})(jQuery);