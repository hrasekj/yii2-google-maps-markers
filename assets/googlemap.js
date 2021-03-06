/**
 * Google Map manager - renders map and put markers
 * Address priority - House Number, Street Direction, Street Name, Street Suffix, City, State, Zip, Country
 */
yii.googleMapManager = (function ($) {
    var pub = {
        nextAddress: 0,
        zeroResult: 0,
        delay: 300,
        bounds: [],
        geocoder: [],
        markerClusterer: null,
        markerClustererOptions: {},
        markers: [],
        infoWindow: [],
        infoWindowOptions: [],
        containerId: 'map_canvas',
        geocodeData: [],
        mapOptions: {
            center: new google.maps.LatLng(53.666464, -2.686693)
        },
        listeners: [],
        renderEmptyMap: true,
        map: null,
        markersLoaded: function () {
        },
        init: function () {
        },
        initModule: function (options) {
            initOptions(options).done(function () {
                google.maps.event.addDomListener(window, 'load', initializeMap);
            });
        },
        /**
         * Get address and place it on map
         */
        getAddress: function (location, htmlContent, icon, callback) {
            var search = location.address;

            if (pub.geocoder) {
                pub.geocoder.geocode({'address': search}, function (results, status) {
                    if (status == google.maps.GeocoderStatus.OK) {
                        var place = results[0];
                        pub.drawMarker(place.geometry.location, htmlContent, icon);
                        pub.delay = 300;
                    }
                    else if (status == google.maps.GeocoderStatus.OVER_QUERY_LIMIT) {
                        pub.nextAddress--;
                        pub.delay = 2000;
                    }
                    else if (status == google.maps.GeocoderStatus.ZERO_RESULTS) {
                        //If first query return zero results, then set address the value of the country
                        if (location.address != location.country) {
                            pub.nextAddress--;
                            pub.geocodeData[pub.nextAddress].address = pub.geocodeData[pub.nextAddress].country;
                        } else {
                            pub.drawMarker(pub.mapOptions.center, htmlContent, icon);
                        }
                    }
                    if (typeof callback === 'function') {
                        callback();
                    }
                });
            }
            else {
                pub.drawMarker(getLatLngFromString(search), htmlContent, icon);
                if (typeof callback === 'function') {
                    callback();
                }
            }
        },
        updatePosition: function (position) {
            var coordinates = [position];
            if (!pub.isPositionUnique(position)) {
                var latitude = position.lat();
                var lngModify = (Math.abs(Math.cos(latitude)) / 111111) * -5;
                var iteration = 0;
                while (true) {
                    iteration++;
                    var newLng = position.lng() + (lngModify * iteration);
                    position = new google.maps.LatLng(latitude + 0.00001, newLng);
                    if (pub.isPositionUnique(position)) {
                        break;
                    }
                    lngModify *= -1;
                }
            }

            coordinates.push(position);

            var path = new google.maps.Polyline({
                path: coordinates,
                geodesic: true,
                strokeColor: '#00AAFF',
                strokeOpacity: 1.0,
                strokeWeight: 0.4
            });
            path.setMap(pub.map);

            return position;
        },
        isPositionUnique: function (position) {
            if (pub.markers.length != 0) {
                for (var i = 0; i < pub.markers.length; i++) {
                    var existingMarker = pub.markers[i];
                    var pos = existingMarker.getPosition();
                    //if a marker already exists in the same position as this marker
                    if (position.equals(pos)) {
                        return false;
                    }
                }
            }

            return true;
        },
        /**
         * Draw marker
         * @param  {google.maps.LatLng} latLng
         * @param  {string} htmlContent
         * @param  {string} icon
         * @return {void}
         */
        drawMarker: function (latLng, htmlContent, icon) {
            var position = pub.updatePosition(latLng);
            pub.bounds.extend(position);
            var marker = new google.maps.Marker({
                map: pub.map,
                position: position,
                icon: icon
            });
            bindInfoWindow(marker, pub.map, pub.infoWindow, htmlContent);
            pub.markerClusterer.addMarker(marker);
            pub.markers.push(marker);
        }
    };

    /**
     * Parse lat long from string.
     * @see  https://stackoverflow.com/questions/26890514/convert-lat-long-string-into-google-maps-api-latlng-object
     * @param  {string} str
     * @return {google.maps.LatLng}
     */
    function getLatLngFromString(str) {
        var latlng = str.split(/, ?/);
        return new google.maps.LatLng(parseFloat(latlng[0]), parseFloat(latlng[1]));
    }

    /**
     * Setup googleMapManager properties
     */
    function initOptions(options) {
        var deferred = $.Deferred();
        pub.bounds = new google.maps.LatLngBounds();
        pub.infoWindow = new google.maps.InfoWindow(pub.infoWindowOptions);
        pub.map = null;
        pub.markerClusterer = null;
        pub.geocodeData = [];
        pub.nextAddress = 0;
        pub.zeroResult = 0;
        pub.markers = [];

        pub.userOptions = options;

        if (options.geocoder === false) {
            pub.geocoder = null;
            delete options.geocoder;
        }
        else {
            pub.geocoder = new google.maps.Geocoder();
        }

        $.extend(true, pub, options);
        deferred.resolve();

        return deferred;
    }

    /**
     * Register listeners
     */
    function registerListeners() {
        for (listener in pub.listeners) {
            if (pub.listeners.hasOwnProperty(listener)) {
                var object = pub.listeners[listener].object;
                var event = pub.listeners[listener].event;
                var handler = pub.listeners[listener].handler;
                google.maps.event.addListener(pub[object], event, handler);
            }
        }
    }

    /**
     * Binds a map marker and infoWindow together on click
     * @param marker
     * @param map
     * @param infoWindow
     * @param html
     */
    function bindInfoWindow(marker, map, infoWindow, html) {
        google.maps.event.addListener(marker, 'click', function () {
            infoWindow.setContent(html);
            infoWindow.open(map, marker);
        });
    }

    function initializeMap() {
        var container = document.getElementById(pub.containerId);
        container.style.width = '100%';
        container.style.height = '100%';
        pub.map = new google.maps.Map(container, pub.mapOptions);
        pub.markerClusterer = new MarkerClusterer(pub.map, [], pub.markerClustererOptions);
        registerListeners();
        loadMap();
    }

    /**
     * Dynamic call fetchPlaces function with delay
     */
    function loadMap() {
        setTimeout(function () {
            if (pub.nextAddress < pub.geocodeData.length) {
                var location = {
                    country: pub.geocodeData[pub.nextAddress].country,
                    address: pub.geocodeData[pub.nextAddress].address
                };
                var htmlContent = pub.geocodeData[pub.nextAddress].htmlContent;
                var icon = pub.geocodeData[pub.nextAddress].icon;
                pub.getAddress(location, htmlContent, icon, loadMap);
                pub.nextAddress++;
            }
            else {
                markersLoaded();
            }
        }, pub.delay);
    }

    function markersLoaded() {
        // fit markers to map bounds
        if (pub.userOptions.mapOptions.center) {
            pub.map.setCenter(pub.mapOptions.center);
        } else {
            google.maps.event.addListenerOnce(pub.map, 'bounds_changed', function () {
                if (pub.map.getZoom() > 17) {
                    pub.map.setZoom(17);
                }
            });
            pub.map.fitBounds(pub.bounds);
        }

        // call user defined callback when markers loaded
        pub.markersLoaded.call(pub);
    }

    return pub;
})(jQuery);
