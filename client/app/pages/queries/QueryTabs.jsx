import React, { useEffect, useState } from "react";
import Tabs from "antd/lib/tabs";
import routeWithUserSession from "@/components/ApplicationArea/routeWithUserSession";
import { Dashboard } from "@/services/dashboard";

import { QuerySource } from "./QuerySource";
import wrapQueryPage from "./components/wrapQueryPage";

const QueryTab = wrapQueryPage(QuerySource);

function QueryTabs({ dashboardSlug }) {
  const [queryIds, setQueryIds] = useState([]);

  useEffect(() => {
    Dashboard.get({ slug: dashboardSlug }).then(dashboardData => {
      const ids = new Set(
        dashboardData.widgets.map(w => w.visualization && w.visualization.query.id).filter(queryId => !!queryId)
      );
      setQueryIds(Array.from(ids));
    });
  }, [dashboardSlug]);
  return (
    <Tabs type="card" className="query-tabs">
      {queryIds.map(queryId => (
        <Tabs.TabPane key={queryId} tab={`Query ${queryId}`}>
          <QueryTab queryId={queryId} />
        </Tabs.TabPane>
      ))}
    </Tabs>
  );
}

export default [
  routeWithUserSession({
    path: "/queries-tabs/:dashboardSlug",
    render: pageProps => <QueryTabs {...pageProps} />,
    bodyClass: "fixed-layout",
  }),
];
