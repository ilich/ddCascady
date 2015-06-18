(function ($) {

    "use strict";

    $.fn.ddCascady = function (options) {
        var settings = $.extend({
            service: null,
            method: "POST",
            firstElementOrderNumber: 0,
            loadAll: false                  // true means user want to load all drop-downs because they contain already selected values
        }, options);

        var loadingInProgress = settings.loadAll;
        var self = this;

        if (loadingInProgress) {
            // Disable all elements and wait till they are all populated
            this.prop("disabled", true);
        }

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

        // values which are used to polulate all drop down lists
        var optionsToLoad = [];
        var dropDownControlLoaded = null;       // Deferred object which is resolved when a drop down has been populated

        this.each(function () {
            var $this = $(this),
                order = $this.data("order"),
                isRoot = order === settings.firstElementOrderNumber;

            // Save value for future realod
            if (settings.loadAll) {
                optionsToLoad[order] = $this.val();
            }

            // Cleanup all drop down's except the root one

            if (isRoot) {
                controls.root = order;
                $this.val("");
            }
            else if (!isRoot && !loadingInProgress) {
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

                if (!loadingInProgress) {
                    var subs = controls.findAllAfter(order);
                    for (var i = 0; i < subs.length; i++) {
                        var sub = subs[i];
                        controls[sub].$element.empty();
                    }
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

                    if (!sub) {
                        // We already selected values in all drop-downs. Raise loaded event.
                        if (dropDownControlLoaded != null) {
                            dropDownControlLoaded.reject();
                        }
                        
                        return;
                    }

                    if (!data.hasOwnProperty(sub.json)) {
                        throw new Error(sub.json + " is not found in service response");
                    }

                    if (loadingInProgress) {
                        sub.$element.empty();
                    }

                    var el = sub.element;
                    var items = data[sub.json];

                    var emptyOption = createOption("", "");
                    el.options.add(emptyOption);

                    for (var i = 0; i < items.length; i++) {
                        var option = createOption(items[i][sub.text], items[i][sub.value]);
                        el.options.add(option);
                    }

                    self.trigger("loaded", [ el ]);

                    if (dropDownControlLoaded !== null) {
                        dropDownControlLoaded.resolve(sub);
                    }
                });
            });
        });

        if (settings.loadAll && optionsToLoad.length > 0) {
            // Load all drop downs

            var optionsCounter = 0;

            var loadDropDown = function (control, valueId) {
                if (valueId >= optionsToLoad.length) {
                    return;
                }

                var value = optionsToLoad[valueId]
                control.$element.val(value).change();
            }

            var initDropDownControlLoaded = function() {
                dropDownControlLoaded = $.Deferred();

                dropDownControlLoaded.done(function (justLoadedControl) {
                    // $.Deferred could be used only once. Let's reinitialize shared dropDownControlLoaded
                    // deferred object

                    initDropDownControlLoaded();

                    // Populate the next drop down on the cascade

                    optionsCounter++;
                    loadDropDown(justLoadedControl, optionsCounter);
                }).fail(function () {
                    // All drop downs has been loaded. Notify client code using loaded event.

                    self.prop("disabled", false);
                    loadingInProgress = false;
                    self.trigger("ready");
                });
            }

            // Start drop downs loading from the root control

            initDropDownControlLoaded();
            
            var root = controls[controls.root];
            if (root) {
                loadDropDown(root, optionsCounter);
            }
        }

        return this;
    };

})(jQuery);