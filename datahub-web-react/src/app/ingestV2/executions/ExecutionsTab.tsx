import { Pagination } from '@components';
import React, { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';

import EmptyState, { EmptyReasons } from '@app/ingestV2/executions/components/EmptyState';
import { ExecutionDetailsModal } from '@app/ingestV2/executions/components/ExecutionDetailsModal';
import ExecutionsTable from '@app/ingestV2/executions/components/ExecutionsTable';
import Filters from '@app/ingestV2/executions/components/Filters';
import useCancelExecution from '@app/ingestV2/executions/hooks/useCancelExecution';
import useFilters from '@app/ingestV2/executions/hooks/useFilters';
import useRefresh from '@app/ingestV2/executions/hooks/useRefresh';
import useRollbackExecution from '@app/ingestV2/executions/hooks/useRollbackExecution';
import RefreshButton from '@app/ingestV2/shared/components/RefreshButton';
import useCommandS from '@app/ingestV2/shared/hooks/useCommandS';
import { TabType } from '@app/ingestV2/types';
import { Message } from '@app/shared/Message';
import { scrollToTop } from '@app/shared/searchUtils';
import usePagination from '@app/sharedV2/pagination/usePagination';

import { useListIngestionExecutionRequestsQuery } from '@graphql/ingestion.generated';
import { ExecutionRequest } from '@types';

const SourceContainer = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: auto;
`;

const HeaderContainer = styled.div`
    flex-shrink: 0;
`;

const StyledTabToolbar = styled.div`
    display: flex;
    justify-content: space-between;
    padding: 0 0 16px 0;
    height: auto;
    z-index: unset;
    box-shadow: none;
    flex-shrink: 0;
`;

const TableContainer = styled.div`
    flex: 1;
    overflow: auto;
`;

const PaginationContainer = styled.div`
    display: flex;
    justify-content: center;
    flex-shrink: 0;
`;

const DEFAULT_PAGE_SIZE = 25;

interface Props {
    shouldPreserveParams: React.MutableRefObject<boolean>;
    hideSystemSources: boolean;
    setHideSystemSources: (show: boolean) => void;
    selectedTab?: TabType | null;
    setSelectedTab: (selectedTab: TabType | null | undefined) => void;
}

export const ExecutionsTab = ({
    shouldPreserveParams,
    hideSystemSources,
    setHideSystemSources,
    selectedTab,
    setSelectedTab,
}: Props) => {
    const [appliedFilters, setAppliedFilters] = useState<Map<string, string[]>>(new Map());
    const [executionRequestUrnToView, setExecutionRequestUrnToView] = useState<undefined | string>(undefined);

    const { page, setPage, start, count: pageSize } = usePagination(DEFAULT_PAGE_SIZE);
    // When filters changed, reset page to 1
    useEffect(() => setPage(1), [appliedFilters, setPage]);

    /**
     * Show or hide system ingestion sources using a hidden command S command.
     */
    useCommandS(() => setHideSystemSources(!hideSystemSources));

    const { filters, hasAppliedFilters } = useFilters(appliedFilters);
    const { loading, error, data, refetch } = useListIngestionExecutionRequestsQuery({
        variables: {
            input: {
                start,
                count: pageSize,
                query: undefined,
                filters,
                systemSources: !hideSystemSources,
            },
        },
    });

    const handleRollbackExecution = useRollbackExecution(refetch);
    const handleCancelExecution = useCancelExecution(refetch);

    const totalExecutionRequests = data?.listExecutionRequests?.total || 0;
    const executionRequests: ExecutionRequest[] = data?.listExecutionRequests?.executionRequests || [];
    const isLastPage = totalExecutionRequests <= pageSize * page;

    // refresh the data when there are some running execution requests
    useRefresh(executionRequests, refetch, loading, selectedTab);

    const onPageChangeHandler = useCallback(
        (newPage: number) => {
            scrollToTop();
            setPage(newPage);
        },
        [setPage],
    );

    return (
        <>
            {error && (
                <Message type="error" content="Failed to load execution requests! An unexpected error occurred." />
            )}
            <>
                <SourceContainer>
                    <HeaderContainer>
                        <StyledTabToolbar>
                            <Filters
                                onFiltersApplied={(newFilters) => setAppliedFilters(newFilters)}
                                hideSystemSources={hideSystemSources}
                                shouldPreserveParams={shouldPreserveParams}
                            />
                            <RefreshButton onClick={() => refetch()} />
                        </StyledTabToolbar>
                    </HeaderContainer>

                    {!loading && executionRequests.length === 0 ? (
                        <EmptyState reason={hasAppliedFilters ? EmptyReasons.FILTERS_APPLIED : EmptyReasons.NO_ITEMS} />
                    ) : (
                        <>
                            <TableContainer>
                                <ExecutionsTable
                                    executionRequests={executionRequests || []}
                                    setFocusExecutionUrn={setExecutionRequestUrnToView}
                                    handleRollback={handleRollbackExecution}
                                    handleCancelExecution={handleCancelExecution}
                                    loading={loading}
                                    isLastPage={isLastPage}
                                    setSelectedTab={setSelectedTab}
                                />
                            </TableContainer>
                            <PaginationContainer>
                                <Pagination
                                    currentPage={page}
                                    itemsPerPage={pageSize}
                                    total={totalExecutionRequests}
                                    showLessItems
                                    onPageChange={onPageChangeHandler}
                                    showSizeChanger={false}
                                    hideOnSinglePage
                                />
                            </PaginationContainer>
                        </>
                    )}
                </SourceContainer>
                {executionRequestUrnToView && (
                    <ExecutionDetailsModal
                        urn={executionRequestUrnToView}
                        open
                        onClose={() => setExecutionRequestUrnToView(undefined)}
                    />
                )}
            </>
        </>
    );
};
