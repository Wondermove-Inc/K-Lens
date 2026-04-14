/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./list.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Icon } from "@skuberplus/icon";
// 🎯 shadcn UI 컴포넌트: 레거시 Badge 대체
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { cssNames } from "@skuberplus/utilities";
import { observer } from "mobx-react";
import React from "react";
import searchUrlPageParamInjectable from "../../input/search-url-page-param.injectable";
import { FilterIcon } from "../filter-icon";
import pageFiltersStoreInjectable from "./store.injectable";

import type { PageParam } from "../../../navigation/page-param";
import type { Filter, PageFiltersStore } from "./store";

export interface PageFiltersListProps {
  filters?: Filter[];
}

interface Dependencies {
  pageFiltersStore: PageFiltersStore;
  searchUrlParam: PageParam<string>;
}

const NonInjectedPageFiltersList = observer(
  ({ pageFiltersStore, searchUrlParam, filters: rawFilters }: Dependencies & PageFiltersListProps) => {
    const filters = rawFilters ?? pageFiltersStore.activeFilters;

    const reset = () => pageFiltersStore.reset();
    const remove = (filter: Filter) => {
      pageFiltersStore.removeFilter(filter);
      searchUrlParam.clear();
    };

    const renderContent = () => {
      if (filters.length === 0) {
        return null;
      }

      return (
        <>
          <div className="header flex gaps">
            <span>Currently applied filters:</span>
            <a onClick={reset} className="reset">
              Reset
            </a>
          </div>
          <div className="labels">
            {filters.map((filter) => {
              const { value, type } = filter;

              return (
                <Badge
                  key={`${type}-${value}`}
                  variant="outline"
                  title={type}
                  className={cssNames("Badge flex gaps filter align-center", type)}
                >
                  <FilterIcon type={type} />
                  <span className="value">{value}</span>
                  <Icon small material="close" onClick={() => remove(filter)} />
                </Badge>
              );
            })}
          </div>
        </>
      );
    };

    return <div className="PageFiltersList">{renderContent()}</div>;
  },
);

export const PageFiltersList = withInjectables<Dependencies, PageFiltersListProps>(NonInjectedPageFiltersList, {
  getProps: (di, props) => ({
    ...props,
    pageFiltersStore: di.inject(pageFiltersStoreInjectable),
    searchUrlParam: di.inject(searchUrlPageParamInjectable),
  }),
});
