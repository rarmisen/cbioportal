/*
 * Copyright (c) 2015 Memorial Sloan-Kettering Cancer Center.
 *
 * This library is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY, WITHOUT EVEN THE IMPLIED WARRANTY OF MERCHANTABILITY OR FITNESS
 * FOR A PARTICULAR PURPOSE. The software and documentation provided hereunder
 * is on an "as is" basis, and Memorial Sloan-Kettering Cancer Center has no
 * obligations to provide maintenance, support, updates, enhancements or
 * modifications. In no event shall Memorial Sloan-Kettering Cancer Center be
 * liable to any party for direct, indirect, special, incidental or
 * consequential damages, including lost profits, arising out of the use of this
 * software and its documentation, even if Memorial Sloan-Kettering Cancer
 * Center has been advised of the possibility of such damage.
 */

/*
 * This file is part of cBioPortal.
 *
 * cBioPortal is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * Created by suny1 on 11/18/15.
 */

var ccPlots = (function (Plotly, _, $) {

    var study_ids = [], study_meta = [], mrna_profiles = [], profile_data = {};

    var gene = [], apply_log_scale = false;

    var fetch_profile_data = function(_queried_study_ids) {

        var _param_mrna_profile_arr = _.map(_queried_study_ids, function(_study_id) { return _study_id + "_rna_seq_v2_mrna"});
        var _param_mut_profile_arr = _.map(_queried_study_ids, function(_study_id) { return _study_id + "_mutations"});

        var _get_genetic_profile_params = {
            genes: gene,
            genetic_profile_ids: _param_mrna_profile_arr.concat(_param_mut_profile_arr)
        };

        window.cbioportal_client.getGeneticProfileData(_get_genetic_profile_params).then(
            function(_result) {
                profile_data = _result;
                study_ids = _.uniq(_.pluck(_result, "study_id"));
                //TODO: apply legit ways to extract profiles, now it's a hack, assuming every study has ONE rna seq v2 profile, and named under the SAME convention
                mrna_profiles =  _.map(study_ids, function(_study_id) { return _study_id + "_rna_seq_v2_mrna"});

                var _get_study_params = {
                    study_ids : study_ids
                };
                window.cbioportal_client.getStudies(_get_study_params).then(
                    function(_study_meta) {
                        study_meta = _study_meta;
                        render();
                    }
                );
            });

    }

    var render = function() {

        var data = [];

        //merge genomic profile data into mutation profile data for mutated samples
        var _mut_data = _.filter(profile_data, function(_obj) { return _obj.hasOwnProperty("mutation_status"); });
        var _tmp_profile_group = _.filter(profile_data, function(_obj) { return !(_obj.hasOwnProperty("mutation_status")); }); //profile data only
        _.each(_tmp_profile_group, function(_profile_obj) {
            var mutation_type = "non";
            var mutation_details = "";
            _.each(_mut_data, function(_mut_obj) {
                if (_profile_obj.study_id === _mut_obj.study_id &&
                    _profile_obj.sample_id === _mut_obj.sample_id) {
                    mutation_type = _mut_obj.mutation_type; //TODO: set a priority list for mutation type
                    mutation_details += _mut_obj.amino_acid_change + ", ";
                }
            });
            _profile_obj.mutation_type = mutation_type;
            _profile_obj.mutation_details = mutation_details.substring(0, mutation_details.length - 2);
        });

        //separate groups
        var _non_mut_group = _.filter(_tmp_profile_group, function(_obj) { return _obj.mutation_type === "non"; });
        var _mix_mut_group = _.filter(_tmp_profile_group, function(_obj) { return _obj.mutation_type !== "non"; });

        //calculate log values
        _.map(_non_mut_group, function(_non_mut_obj){
            var _ori_val = _non_mut_obj.profile_data;
            _non_mut_obj.logged_profile_data = Math.log(_ori_val) / Math.log(2);
            return _non_mut_obj;
        });
        _.map(_mix_mut_group, function(_mut_obj){
            var _ori_val = _mut_obj.profile_data;
            _mut_obj.logged_profile_data = Math.log(_ori_val) / Math.log(2);
            return _mut_obj;
        });

        // ---- define tracks ----
        // no mutation
        //assemble array of qtip text
        var _qtips = [];
        _.each(_non_mut_group, function(_non_mut_obj) {
            _qtips.push("Study: " +  _non_mut_obj.study_id + "<br>" +"Sample Id: " + _non_mut_obj.sample_id + "<br>" + "Expression: " + _non_mut_obj.profile_data);
        });
        //assemble y axis values
        var _y = [];
        if (apply_log_scale) {
            _y = _.pluck(_non_mut_group, "logged_profile_data");
        } else {
            _y = _.pluck(_non_mut_group, "profile_data");
        }
        var non_mut_track = {
            x: _.map(_.pluck(_non_mut_group, "study_id"), function(_study_id){ return study_ids.indexOf(_study_id) + Math.random() * 0.3 - 0.15; }),
            y: _y,
            mode: 'markers',
            type: 'scatter',
            name: 'No Mutation',
            text: _qtips,
            marker: {
                color: '#00AAF8',
                size: 5,
                line: {color: '#0089C6', width: 1.2}
            },
            hoverinfo: "text"
        };
        data.push(non_mut_track);

        //mutated tracks
        var _mut_shapes = ["triangle-up", "diamond", "cross", "square", "triangle-down", "pentagon", "hourglass"],
            _mut_colors = ["#DF7401", "#1C1C1C", "#DF7401", "#1C1C1C", "#DF7401", "#1C1C1C", "#DF7401"];
        var _mut_types = _.uniq(_.pluck(_mix_mut_group, "mutation_type"));
        $.each(_mut_types, function(_index, _mut_type) {
            var _mut_group = _.filter(_mix_mut_group, function(_obj) { return _obj.mutation_type === _mut_type; });
            //assemble array of qtip text
            var _qtips = [];
            _.each(_mut_group, function(_mut_obj) {
                _qtips.push("Study: " + _mut_obj.study_id + "<br>" + "Sample Id: " + _mut_obj.sample_id + "<br>" + "Expression: " + _mut_obj.profile_data + "<br>" + "Mutation Type: " + _mut_obj.mutation_type);
            });
            var _y = [];
            if (apply_log_scale) {
                _y = _.pluck(_mut_group, "logged_profile_data");
            } else {
                _y = _.pluck(_mut_group, "profile_data");
            }
            var _mut_track = {
                x: _.map(_.pluck(_mut_group, "study_id"), function(_study_id){ return study_ids.indexOf(_study_id) + Math.random() * 0.3 - 0.15; }),
                y: _y,
                mode: 'markers',
                type: 'scatter',
                name: _mut_type,
                text: _qtips,
                marker: {
                    color: _mut_colors[_index],
                    size: 6,
                    line: {color: '#B40404', width: 1.2},
                    symbol: _mut_shapes[_index]
                },
                hoverinfo: "text"
            };
            data.push(_mut_track);
        });

        //box plots
        _.each(mrna_profiles, function(_profile_id) {
            var _y = [];
            if (apply_log_scale) {
                _y = _.pluck(_.filter(_non_mut_group.concat(_mix_mut_group), function(_result_obj) { return _result_obj.genetic_profile_id == _profile_id; }), "logged_profile_data");
            } else {
                _y = _.pluck(_.filter(_non_mut_group.concat(_mix_mut_group), function(_result_obj) { return _result_obj.genetic_profile_id == _profile_id; }), "profile_data");
            }
            var _box = {
                y: _y,
                x0: mrna_profiles.indexOf(_profile_id),
                type: 'box',
                opacity: 0.6,
                marker: {
                    color: 'grey',
                    size: 7
                },
                line: { width: 1},
                boxpoints: false,
                showlegend: false
            };
            data.push(_box);
        });

        // ---- define layout ----
        var vals = [];
        for (var i = 0 ; i < mrna_profiles.length; i++) {
            vals.push(i);
        }
        var layout = {
            hovermode:'closest',
            margin: {
                t: 20,
                b: 200,
                l: 110
            },
            xaxis: {
                tickmode: "array",
                ticktext: _.pluck(study_meta, "short_name"),
                tickvals: vals,
                tickangle: 45
            },
            yaxis: {
                title: apply_log_scale?gene + ' Expression --- RNA Seq V2 (log)':gene + " Expression --- RNA Seq V2"
            }
        };

        $("#cc-plots-box").empty();
        Plotly.newPlot('cc_plots_box', data, layout, {showLink: false});

        //link to sample view
        var ccPlotsElem = document.getElementById('cc_plots_box');
        ccPlotsElem.on('plotly_click', function(data){
            var _pts = data.points[0].fullData.text[data.points[0].pointNumber];
            var _pts_study = _pts.substring(_pts.indexOf("Study: ") + 7, _pts.indexOf("Sample Id: ") - 4);
            var _pts_sample_id = _pts.substring(_pts.indexOf("Sample Id: ") + 11, _pts.indexOf("Expression: ") - 4);
            window.open(cbio.util.getLinkToSampleView(_pts_study, _pts_sample_id));
        });

    }



    return {
        init: function() {
            var tmp = setInterval(function () {timer();}, 1000);
            function timer() {
                if (window.studies !== undefined) {
                    clearInterval(tmp);

                    //default settings
                    gene = [];
                    gene.length = 0;
                    gene.push($("#cc_plots_gene_list").val());
                    apply_log_scale = document.getElementById("cc_plots_log_scale").checked;

                    $("#cc_plots_box").empty();
                    fetch_profile_data(_.pluck(_.pluck(window.studies.models, "attributes"), "studyId"));
                }
            }
        },
        update_gene: function() {
            gene = [];
            gene.length = 0;
            gene.push($("#cc_plots_gene_list").val());
            $("#cc-plots-box").empty();
            $("#cc-plots-box").append("<img src='images/ajax-loader.gif' id='cc_plots_loading' style='padding:200px;'/>");
            fetch_profile_data(_.pluck(_.pluck(window.studies.models, "attributes"), "studyId"));
        },
        update_profile_order: function() {},
        toggle_log_scale: function() {
            apply_log_scale = document.getElementById("cc_plots_log_scale").checked;
            $("#cc-plots-box").empty();
            $("#cc-plots-box").append("<img src='images/ajax-loader.gif' id='cc_plots_loading' style='padding:200px;'/>");
            fetch_profile_data(_.pluck(_.pluck(window.studies.models, "attributes"), "studyId"));
        }
    };

}(window.Plotly, window._, window.jQuery));

