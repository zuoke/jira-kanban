import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import { chain, cloneDeep, find } from "lodash";
import cx from "classnames";
import { Responsive, WidthProvider } from "react-grid-layout";
import { VisualizationWidget, TextboxWidget, RestrictedWidget } from "@/components/dashboards/dashboard-widget";
import { FiltersType } from "@/components/Filters";
import cfg from "@/config/dashboard-grid-options";
import AutoHeightController from "./AutoHeightController";
import { WidgetTypeEnum } from "@/services/widget";

import "react-grid-layout/css/styles.css";
import "./dashboard-grid.less";

const ResponsiveGridLayout = WidthProvider(Responsive);

const WidgetType = PropTypes.shape({
  id: PropTypes.number.isRequired,
  options: PropTypes.shape({
    position: PropTypes.shape({
      col: PropTypes.number.isRequired,
      row: PropTypes.number.isRequired,
      sizeY: PropTypes.number.isRequired,
      minSizeY: PropTypes.number.isRequired,
      maxSizeY: PropTypes.number.isRequired,
      sizeX: PropTypes.number.isRequired,
      minSizeX: PropTypes.number.isRequired,
      maxSizeX: PropTypes.number.isRequired,
    }).isRequired,
  }).isRequired,
});

const SINGLE = "single-column";
const MULTI = "multi-column";

function normalizeFrom(widget) {
  const {
    id,
    options: { position: pos },
  } = widget;

  return {
    i: id.toString(),
    x: pos.col,
    y: pos.row,
    w: pos.sizeX,
    h: pos.sizeY,
    minW: pos.minSizeX,
    maxW: pos.maxSizeX,
    minH: pos.minSizeY,
    maxH: pos.maxSizeY,
  };
}

export default function NewDashboardGrid({
  isEditing,
  isPublic,
  dashboard,
  widgets,
  filters,
  onBreakpointChange: onBreakpointChangeProp,
  onLoadWidget,
  onRefreshWidget,
  onRemoveWidget,
  onLayoutChange: onLayoutChangeProp,
  onParameterMappingsChange,
}) {
  const mode = useRef(null);
  const [layouts, setLayouts] = useState({});
  const [disableAnimations, setDisableAnimations] = useState(true);

  const onBreakpointChange = useCallback(
    breakpoint => {
      mode.current = breakpoint;
      onBreakpointChangeProp(breakpoint === SINGLE);
    },
    [onBreakpointChangeProp]
  );

  const onBreakpointChangeRef = useRef();
  onBreakpointChangeRef.current = onBreakpointChange;

  // height updated by auto-height
  const onWidgetHeightUpdated = useCallback((widgetId, newHeight) => {
    setLayouts(currentLayouts => {
      const layout = cloneDeep(currentLayouts[MULTI]); // must clone to allow react-grid-layout to compare prev/next state
      const item = find(layout, { i: widgetId.toString() });
      if (item) {
        // update widget height
        item.h = Math.ceil((newHeight + cfg.margins) / cfg.rowHeight);
      }

      return { [MULTI]: layout };
    });
  }, []);

  const autoHeightCtrl = useMemo(() => new AutoHeightController(onWidgetHeightUpdated), [onWidgetHeightUpdated]);
  useEffect(() => () => autoHeightCtrl.destroy(), [autoHeightCtrl]);

  // height updated by manual resize
  const onWidgetResize = useCallback(
    (layout, oldItem, newItem) => {
      if (oldItem.h !== newItem.h) {
        autoHeightCtrl.remove(Number(newItem.i));
      }

      autoHeightCtrl.resume();
    },
    [autoHeightCtrl]
  );

  const normalizeTo = useCallback(
    layout => ({
      col: layout.x,
      row: layout.y,
      sizeX: layout.w,
      sizeY: layout.h,
      autoHeight: autoHeightCtrl.exists(layout.i),
    }),
    [autoHeightCtrl]
  );

  const onLayoutChange = useCallback(
    (_, layouts) => {
      // workaround for when dashboard starts at single mode and then multi is empty or carries single col data
      // fixes test dashboard_spec['shows widgets with full width']
      // TODO: open react-grid-layout issue
      if (layouts[MULTI]) {
        setLayouts(layouts);
      }

      // workaround for https://github.com/STRML/react-grid-layout/issues/889
      // remove next line when fix lands
      mode.current = document.body.offsetWidth <= cfg.mobileBreakPoint ? SINGLE : MULTI;
      // end workaround

      // don't save single column mode layout
      if (mode.current === SINGLE) {
        return;
      }

      const normalized = chain(layouts[MULTI])
        .keyBy("i")
        .mapValues(normalizeTo)
        .value();

      onLayoutChangeProp(normalized);
    },
    [normalizeTo, onLayoutChangeProp]
  );

  useEffect(() => {
    onBreakpointChangeRef.current(document.body.offsetWidth <= cfg.mobileBreakPoint ? SINGLE : MULTI);

    // Work-around to disable initial animation on widgets; `measureBeforeMount` doesn't work properly:
    // it disables animation, but it cannot detect scrollbars.
    const disableAnimationsTimer = setTimeout(() => {
      setDisableAnimations(false);
    }, 50);

    return () => clearTimeout(disableAnimationsTimer);
  }, []);

  useEffect(() => {
    // update, in case widgets added or removed
    autoHeightCtrl.update(widgets);
  }, [autoHeightCtrl, widgets]);

  // memoize to improve ReactGridLayout performance -- https://github.com/STRML/react-grid-layout#performance
  const widgetComponents = useMemo(
    () =>
      widgets.map(widget => {
        const widgetProps = {
          widget,
          filters,
          isPublic,
          canEdit: dashboard.canEdit(),
          onDelete: () => onRemoveWidget(widget.id),
        };
        const { type } = widget;
        return (
          <div
            key={widget.id}
            data-grid={normalizeFrom(widget)}
            data-widgetid={widget.id}
            data-test={`WidgetId${widget.id}`}
            className={cx("dashboard-widget-wrapper", {
              "widget-auto-height-enabled": autoHeightCtrl.exists(widget.id),
            })}>
            {type === WidgetTypeEnum.VISUALIZATION && (
              <VisualizationWidget
                {...widgetProps}
                dashboard={dashboard}
                onLoad={() => onLoadWidget(widget)}
                onRefresh={() => onRefreshWidget(widget)}
                onParameterMappingsChange={onParameterMappingsChange}
                isEditing={isEditing} // make sure it re-renders when isEditing changes
              />
            )}
            {type === WidgetTypeEnum.TEXTBOX && <TextboxWidget {...widgetProps} />}
            {type === WidgetTypeEnum.RESTRICTED && <RestrictedWidget widget={widget} />}
          </div>
        );
      }),
    [
      autoHeightCtrl,
      dashboard,
      filters,
      isEditing,
      isPublic,
      onLoadWidget,
      onParameterMappingsChange,
      onRefreshWidget,
      onRemoveWidget,
      widgets,
    ]
  );

  return (
    <div className={cx("dashboard-wrapper", isEditing ? "editing-mode" : "preview-mode")}>
      <ResponsiveGridLayout
        className={cx("layout", { "disable-animations": disableAnimations })}
        cols={{ [MULTI]: cfg.columns, [SINGLE]: 1 }}
        rowHeight={cfg.rowHeight - cfg.margins}
        margin={[cfg.margins, cfg.margins]}
        isDraggable={isEditing}
        isResizable={isEditing}
        onResizeStart={autoHeightCtrl.stop}
        onResizeStop={onWidgetResize}
        layouts={layouts}
        onLayoutChange={onLayoutChange}
        onBreakpointChange={onBreakpointChange}
        breakpoints={{ [MULTI]: cfg.mobileBreakPoint, [SINGLE]: 0 }}>
        {widgetComponents}
      </ResponsiveGridLayout>
    </div>
  );
}

NewDashboardGrid.propTypes = {
  isEditing: PropTypes.bool.isRequired,
  isPublic: PropTypes.bool,
  dashboard: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  widgets: PropTypes.arrayOf(WidgetType).isRequired,
  filters: FiltersType,
  onBreakpointChange: PropTypes.func,
  onLoadWidget: PropTypes.func,
  onRefreshWidget: PropTypes.func,
  onRemoveWidget: PropTypes.func,
  onLayoutChange: PropTypes.func,
  onParameterMappingsChange: PropTypes.func,
};

NewDashboardGrid.defaultProps = {
  isPublic: false,
  filters: [],
  onLoadWidget: () => {},
  onRefreshWidget: () => {},
  onRemoveWidget: () => {},
  onLayoutChange: () => {},
  onBreakpointChange: () => {},
  onParameterMappingsChange: () => {},
};
