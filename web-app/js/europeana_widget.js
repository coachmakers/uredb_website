/**
 * This module exports three functions
 * 
 * makeGrid() -- make a grid of europeana thumbnails -exclude blacklisted items
 * 
 * doEuRelated() --fetch data from europeana queries, and turn into html divs
 * for use with makeGrid. Fire done signal "fire_EuComparanda", picked up by
 * eu_comparanda call.
 * 
 * voterSetup() -- set up relevance voting
 * 
 * 
 */
(function() {
  /**
   * @memberOf europeana_widget doEuRelated
   */
  var doEuRelated = function(templateSel, gridSel, data, incrementCursor, completed_callback) {
    
    data = JSON.stringify(data);
    var endpoint_url = "/api/related";
    var blank_image_100x100 = "/static/images/blank100x100.png";
    var titleWordLength = 10;
    var providerlist = {}; // provider list

    var template = $($(templateSel + " .gridlist-cell")[0]).clone();

    /**
     * @memberOf europeana_widget.doEuRelated
     */
    // make style for each element.
    var makeStyle = function(w, h, thumburl) {
      return 'width:' + w + '; height:' + h + '; background-image: url(' + thumburl + ')';
    };

    /**
     * @memberOf europeana_widget.doEuRelated
     * 
     * make a date for overlay from europeana metadata return null if metadata
     * missing.
     */
    var getDate = function(item) {

      var out = "";
      if ('edmTimespanLabel' in item && item.edmTimespanLabel !== "")
        out += item.edmTimespanLabel[0].def + " ";
      if ('edmTimespanBroaderTerm' in item && item.edmTimespanBroaderTerm)
        out += item.edmTimespanBroaderTerm;
      return out;
    };
    /**
     * @memberOf europeana_widget.doEuRelated
     */
    var getTitle = function(title) {
      var out = title[0];
      var t = out.split(" ");
      if (t.length > titleWordLength)
        out = t.splice(0, titleWordLength).join(" ");
      return out;
    };

    /**
     * @memberOf europeana_widget.doEuRelated
     */
    var makeProviderlist = function(provs) {
      console.log('makeng provider list... ');
      var providers = Object.keys(provs);
      console.log(providers.length);

      for (var i = 0; i < providers.length; i++) {
        var t = $($("#provider-label-template label")[0]).clone();

        var provider = providers[i];
        $(t).attr('data-eu-provider-list', provider);

        $(t).find('input').val(provider);
        $(t).append('<span class="provider">' + provider + '</span>');

        $("#provider-filter").append(t);
      }
    };
    /**
     * @memberOf europeana_widget.doEuRelated called from success
     */
    var fillGrid = function(items, width, height, displayInfobox) {

      var hideInfodiv = displayInfobox ? "hide-infodiv" : "showtheinfobox";
      for (var i = 0; i < items.length; i++) {

        var item = items[i];
        var provider = item.dataProvider;
        if (!(provider in providerlist))
          providerlist[provider] = provider;
        var t = $(template).clone();
        if ('edmPreview' in item) {
          item.thumb = item.edmPreview;
        } else {
          item.thumb = blank_image_100x100;
        }

        var style = makeStyle(width, height, item.thumb);
        $(t).attr('data-ure-uri', item.edmPreview);
        $(t).attr('data-eu-provider', item.dataProvider);
        $(t).attr('data-eu-id', item.id);
        $(t).attr('data-eu-guid', item.guid);
        $(t).attr('data-eu-link', item.edmIsShownAt);
        $(t).attr('data-ure-image-url', item.edmPreview);
        if ("dcSubjectLangAware" in item)
          $(t).attr('data-ure-dcSubject', item.dcSubjectLangAware.def);
        $(t).attr('style', style);
        $(t).find(".short_title").html(item.title);
        $(t).find(".caption").html(item.dataProvider);

        $(t).find(".date").html(getDate(item));

        $(t).addClass(hideInfodiv);

        $(gridSel).append(t);
      }

    };
    /**
     * @memberOf europeana_widget.doEuRelated
     */
    var success = function(data) {
      var width, height, displayInfobox, items;
      width = data.width;
      height = data.height;
      displayInfobox = data.displayInfobox;

      if (data && 'info' in data && 'items' in data.info)
        try {
          items = data.info.items;

        } catch (e) {
          items = [];
          alert("can't load eu items!");
        }

      /** clear the grid */

      $(gridSel).html("");
      // TODO save cleared items somewhere for re-display
      // TODO exception no data

      /** update the cursor */

      // TODO ONLY if this is "next" call
      if ('eu_cursor' in window) {
        if (incrementCursor === true)
          window.eu_cursor += data.info.itemsCount;
      } else {
        window.eu_cursor = data.info.itemsCount;
      }

      /** populate the grid with items */
      fillGrid(items, width, height, displayInfobox);

      /** make controls */

      makeProviderlist(providerlist);
      $("#itemsCount").html(window.eu_cursor);
      $("#total-results").html(data.info.totalResults);

      /** trigger freewall recompute. */
      $(window).trigger("resize");

      /** run callbacks */
      completed_callback.call(this);

      /** send done signal */
      var signal = "doEuRelated_complete";
      var e = $.Event(signal);
      $(window).trigger(e, {
        id : "finished doEuRelated"
      });
    }; // success

  

    var success_new = function(info) {
      console.log('success_new');
      var data = {};
      // re-jig data to fit old model.
      data.info = info; // the return object from EU
      data.width = "100px";
      data.height = "100px";
      data.displayInfoboxOnHover = false;
      
      return success(data);

    };
    /**
     * @memberOf europeana_widget.doEuRelated
     */
    var new_ajax = function() {
      var keywords = JSON.parse(data).keywords;
      var startrec  = JSON.parse(data).startrec;
      var fail = function(e) { console.log(e); }; // fail
      var done = success_new;
      var complete = function() {
        console.log("complete!");
      };
      
      var get_query = function(kw) {
        return kw.join("+AND+");
      };
      console.log(data['keywords']);
      var qs = get_query(keywords);
      // TODO -- fix fails if there isn't a thumbnail
      var query = 'wskey='+uredb_wskey+'&query=' + qs + '&thumbnail=true&rows=100&start=' + startrec + '&profile=standard';
      var url_base = 'https://www.europeana.eu/api/v2/search.json?';
      var url_new = url_base + query;
      console.log(url_new);
      $.ajax({
        url : url_new,
        dataType : "json",
        type : "GET"

      }).done(done).fail(fail).complete(complete);
    };
    new_ajax();

  }; // END doEuRelated

  window.europeanaWidget_doEuRelated = doEuRelated;
  /**
   * @memberOf europeana_widget
   */
  var makeGrid = function(gridid, width, height, displayInfobox, wallWidth, accnum) {
    console.log("makeGrid");
    var storage, cellSelector, blacklist_store, providerBlacklist, providerBlacklistThreshold, providerBlacklist_store;

    blacklist_store = "vote";
    providerBlacklist_store = "providerBlacklist";
    providerBlacklistThreshold = 1;
    cellSelector = gridid + " .cell";
    storage = $.localStorage;

    // get providerBlacklist or start one if none
    if (storage.isSet(providerBlacklist_store)) {
      providerBlacklist = storage.get(providerBlacklist_store);
    } else {
      providerBlacklist = storage.set(providerBlacklist_store, {});
    }

    // Remove blacklisted items in "vote" localstorage
    if (storage.isSet(blacklist_store)) {
      var vote = storage.get(blacklist_store);
      $(cellSelector).each(function(k, v) {
        var id = $(this).attr('data-ure-image-url');
        var provider = $(this).attr('data-eu-provider');
        // if the id is in the blacklist (=vote), remove it from the grid

        if (accnum in vote && id in vote[accnum]) {
          $(this).remove();
        }

        // remove items from blacklisted providers.
        if (provider in providerBlacklist && providerBlacklist[provider] > providerBlacklistThreshold) {
          // remove item
          $(this).remove();
          // remove filter in provider checklist
          // console.log($('[data-eu-provider-list="' + provider + '"]'));
          // console.log(provider);
          $('[data-eu-provider-list="' + provider + '"]').remove();

        }

      });
    }

    // build the grid.
    var wall = new Freewall(gridid);
    wall.reset({
      selector : '.cell',
      delay : 25,
      animate : true,
      cellW : width,
      cellH : height,
      onResize : function() {
        wall.refresh();
      }
    });
    wall.fitWidth(wallWidth);
    // for scroll bar appear;
    $(window).trigger("resize");

    $(gridid).delay(3000).show();

    // show the infobox on hover

    if (displayInfobox === true) {
      $(cellSelector).hover(function() {
        $(this).find(".image-infobox").toggleClass("hide-infodiv");
      });
    }
    $(cellSelector).css("cursor", "pointer");
    /**
     * @memberOf europeana_widget.makeGrid
     */
    // click on image pops to overlay
    var overlayHandler = function() {
      var url = $(this).attr("data-eu-link");
      $("#externalsite-iframe").attr('src', url);

      $("#iframeOverlay").slideDown(1000);
      $("#externalsite-iframe").load(function() {
        $("#externalsite-iframe").fadeIn(1000);
      });
      // add data to the add-item button
      var eu_link = $(this).attr("data-eu-link");
      var thumb = $(this).attr("data-ure-image-url");
      var guid = $(this).attr("data-eu-guid");
      var eu_item = {
        link : eu_link,
        thumb : thumb,
        ure_accnum : $(document).ure_accnum,
        guid : guid
      };
      // add data about this object to the add-item button in the overlay

      $("#add-item").data('eu_item', eu_item);
    };
    $(cellSelector).bind('click', overlayHandler);
    window.wall = wall;
    window.overlayHandler = overlayHandler;
    // END
  };

  window.europeanaWidget_makeGrid = makeGrid;

  /**
   * @memberOf europeana_widget relevance voting
   * 
   * voteSetup
   * 
   * put a vote button on each -- when pressed , disappears problem: need to
   * turn off overlay click. problem: image selection is currently done on
   * server! server needs to send pure json
   */

  var voteSetup = function(itemSelector, toggleSelector, accnum) {
    console.log('voteSetup');
    var voteHandler;

    storage = $.localStorage;
    // create vote object if not present
    if (!(storage.isSet('vote'))) {
      console.log("setting vote...");
      storage.set('vote', {});
    }
    if (!(storage.isSet('providerBlacklist'))) {
      console.log("setting providerBlacklist...");
      storage.set('providerBlacklist', {});
    }
    /**
     * @memberOf europeana_widget.voteSetup
     */
    var vote = function(divs) {
      var votebutton = '<button class="voterbtn btn btn-sm btn-success">x</button>';
      // overlay a click button
      $(divs).each(function(k, v) {
        $(v).append(votebutton);
      });

      // remove the overlay click function
      $(itemSelector).unbind('click', window.overlayHandler);

      /**
       * Vote handler
       * 
       * @memberOf europeana_widget.voteSetup.vote
       * 
       * Handle click events on irrelevant items
       */
      voteHandler = function() {
        var item, provider, v, providerBlacklist, providerBlacklist_store, vote_store;
        providerBlacklist_store = 'providerBlacklist';
        vote_store = 'vote';

        // show red on vote
        $(this).toggleClass('btn-success').toggleClass('btn-danger');
        v = storage.get(vote_store);

        providerBlacklist = storage.get(providerBlacklist_store);
        item = $(this).parent().attr('data-ure-image-url');
        provider = $(this).parent().attr('data-eu-provider');

        if ($(this).hasClass('btn-danger')) {

          // add to blacklist
          if (!(accnum in v))
            v[accnum] = {};

          v[accnum][item] = "";

          // add to provider blacklist
          providerBlacklist[provider] = provider in providerBlacklist ? providerBlacklist[provider] + 1 : 1;
          // provider in providerBlacklist ? providerBlacklist[provider] += 1 :
          // providerBlacklist[provider] = 1

        }

        else {
          // remove from blacklist
          if (accnum in v && item in v[accnum]) {
            delete v[accnum][item];
          }

          if (provider in providerBlacklist) {

            if (providerBlacklist[provider] > 1) {
              providerBlacklist[provider] -= 1;
            } else {
              delete providerBlacklist[provider];

            }
          }
        }

        // save the results
        storage.set('vote', v);
        storage.set('providerBlacklist', providerBlacklist);
        window.eu_test_vote = v;
      };

      $(document).on('click', '.voterbtn', voteHandler);
      // END vote
    }; // vote = function(divs)

    /** Toggle irrelevance voting */
    // remove all previous handlers so we don't bounce.
    $(document).off('click', toggleSelector);

    $(document).on('click', toggleSelector, function() {
      var startText = "tag as not relevant";
      var sw = $(this).attr('data-relevance-toggle');
      if (sw === 'off') {
        vote(itemSelector);
        $(this).attr('data-relevance-toggle', 'on');
        $(this).html($(this).data('relevance-finish'));
      } else {
        // we're done
        $(itemSelector).unbind('click', voteHandler);
        $('.voterbtn').remove();
        $(itemSelector).bind('click', window.overlayHandler);
        $(this).attr('data-relevance-toggle', 'off');
        $(this).html(startText);

        // send done signal -- pick up in _europeanaWidget
        var signal = "relevance_tag_complete";
        alert(signal);
        var e = $.Event(signal);
        $(window).trigger(e, {
          id : signal
        });

      }

    });
  }; // voteSetup
  window.europeanaWidget_voteSetup = voteSetup;
})();

!function() {
  /**
   * Set up Eu related grid and helper functions
   */
  /**
   * @memberOf europeana_widget
   */
  console.log("init_euRelated");
  var init_euRelated = function(accnum, gridid, width, height, displayInfobox) {

    /**
     * @memberOf europeana_widget.init_euRelated
     * 
     * get keywords from record data in DOM
     * 
     */
    var make_keywords = function() {
      // TODO needs to be configureable!!!
      var kw = [];

      var title = $('.ure-title').text();
      var title_kw = title.replace(/[^a-zA-Z\s]/g, "").replace(/\s+/g," ").replace(/^\s+/g,"").replace(/\s$/g,"").split(" ");
      if (title.match(/red figure/)) {
        kw.push('where:(red+AND+figure)');
      }
      if (title.match(/black figure/)) {
        kw.push('where:(black+AND+figure)');
      }
      var fabric = $('.ure-fabric').text();
      if (fabric !== "") {
        var fabric_kw = fabric.replace(/[^a-zA-Z\s]/g, "").replace(/\s+/g," ").replace(/^\s+/g,"").replace(/\s$/g,"").split(" ")
        kw = kw.concat(fabric_kw);
      }
     
      var keywords = [ 'where(greece+AND+black+AND+figure)' ];
      
      if (kw.length > 1) {
        keywords = kw;
      } 
      else {
        if (title_kw.length > 1) {
          
          keywords = title_kw;
        }
      }
      return keywords;
    };

    /**
     * @memberOf europeana_widget.init_euRelated
     * 
     * get the query data
     */
    var make_eu_query_data = function() {
      /**
       * @memberOf europeana_widget.init_euRelated.make_eu_query_data
       */
      var get_startrec = function() {
        var out = 1;
        if ('eu_cursor' in window) {
          out = window.eu_cursor;

        }

        return out;
      };

      /**
       * @memberOf europeana_widget.init_euRelated.make_eu_query_data
       */
      var startrec = get_startrec();

      /**
       * @memberOf europeana_widget.init_euRelated.make_eu_query_data
       */
      var kw_json = make_keywords();

      /**
       * @memberOf europeana_widget.init_euRelated.make_eu_query_data
       */
      // make data for eu related ajax call
      var data = {
        accnum : accnum,
        keywords : kw_json,
        gridid : "euwidget",
        klass : "euwidget",
        displayInfobox : "true",
        height : "100px",
        width : "100px",
        startrec : startrec
      };
      return data;
    };
    var set_query_display = function(qs) {
      $("#query-display").html(qs);
    };
    /**
     * @memberOf europeana_widget.init_euRelated
     */
    var makeEuRelatedItems = function(incrementCursor) {

      var data = make_eu_query_data();
      set_query_display(data.keywords.join(' '));
      var templateSel = "#gridTemplate";
      var gridSel = "#" + gridid;
      // set up freewall grid and some other stuff
      // TODO has to be called at end of eu ajax, so we'll pass it in as a
      // callback
      var eu_makegrid = function() {
        europeanaWidget_makeGrid("#" + gridid, width, height, displayInfobox, 1100, accnum);
      };
      europeanaWidget_doEuRelated(templateSel, gridSel, data, incrementCursor, eu_makegrid);

      // set up the voting.
      europeanaWidget_voteSetup("#" + gridid + " .cell", '#relevance-vote', accnum);
    };
    $(document).ready(function() {
      makeEuRelatedItems(false);
    });

    /**
     * @memberOf europeana_widget.init_euRelated
     */
    var signal = "relevance_tag_complete";
    $(window).on(signal, function(e, data) {
      console.log(signal);
      makeEuRelatedItems(false);
    });

    /**
     * 
     * More eu items
     */
    $(document).on('click', '#itemsCount', function() {
      // get the next batch..
      makeEuRelatedItems(true);
    });
    /**
     * Museum filter pane toggle
     */
    $(document).on('click', '.cb-eu', function() {
      console.log(this);
      console.log($(this).val());
      var mus = $(this).val();
      $('[data-eu-provider="' + mus + '"]').toggle();
      $(window).trigger("resize");

    });
  };
  window.init_euRelated = init_euRelated;
}()
