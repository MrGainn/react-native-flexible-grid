/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-native/no-inline-styles */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Platform, RefreshControl, ScrollView, View } from 'react-native';
import useThrottle from '../hooks/use-throttle';
import { renderPropComponent } from '../libs/render-prop-component';
import { calcResponsiveGrid } from './calc-responsive-grid';
import type { ResponsiveGridProps, TileItem } from './types';

const isAndroid = Platform.OS === 'android';

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  data = [],
  maxItemsPerColumn = 3,
  virtualizedBufferFactor = 5,
  renderItem,
  autoAdjustItemWidth = true,
  scrollEventInterval = 200, // milliseconds
  virtualization = true,
  showScrollIndicator = true,
  style = {},
  itemContainerStyle = {},
  itemUnitHeight,
  onEndReached,
  onEndReachedThreshold = 0.5, // default to 50% of the container height
  keyExtractor = (_, index) => String(index), // default to item index if no keyExtractor is provided
  HeaderComponent = null,
  FooterComponent = null,
  direction = 'ltr',
  onScrollList,
  scrollRef,
  visibleItemsWithPlayVideo,
  refreshing,
  onRefresh
}) => {
  const [visibleItems, setVisibleItems] = useState<TileItem[]>([]);

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const onEndReachedCalled = useRef<boolean>(false);

  const scrollYPosition = useRef<number>(0);

  const [footerComponentHeight, setFooterComponentHeight] = useState(0);

  const [headerComponentHeight, setHeaderComponentHeight] = useState(0);

  const { gridViewHeight, gridItems } = useMemo(
    () =>
      calcResponsiveGrid(
        data,
        maxItemsPerColumn,
        containerSize.width,
        itemUnitHeight,
        autoAdjustItemWidth
      ),
    [data, maxItemsPerColumn, containerSize, autoAdjustItemWidth]
  );

  const renderedItems = virtualization ? visibleItems : gridItems;

  const sumScrollViewHeight =
    gridViewHeight + headerComponentHeight + footerComponentHeight;

    const getVisibleItems = (buffer: number) => {
      const visibleStart = Math.max(0, scrollYPosition.current - buffer);
      const visibleEnd = scrollYPosition.current + containerSize.height + buffer;
    
      return gridItems.filter((item: TileItem) => {
        const itemBottom = item.top + item.height;
        const itemTop = item.top;
        return itemBottom > visibleStart && itemTop < visibleEnd;
      });
    };

    const getVisibleItemsNoBuffer = () => {
      const visibleStart = scrollYPosition.current; // Top of the viewport
      const visibleEnd = scrollYPosition.current + containerSize.height; // Bottom of the viewport
    
      return gridItems.filter((item: TileItem) => {
        const itemTop = item.top+ item.height;
        const itemBottom = item.top + 550;

        // Ensure the item is **fully visible** inside the viewport
        return itemTop >= visibleStart && itemBottom <= visibleEnd;
      });
    };
    
    const updateVisibleItems = () => {
      if (!virtualization) return;
    
      const buffer = containerSize.height * virtualizedBufferFactor;
      
      // Get visible items with normal buffer
      const vItems = getVisibleItems(buffer);
      setVisibleItems(vItems);

        if (visibleItemsWithPlayVideo) {
      
        // Log the result with buffer = 0
        const exactVisibleItems = getVisibleItemsNoBuffer()

        // Extract postIds where heightRatio === 2
        const postIdsWithHeightRatio2 = exactVisibleItems
          .filter((item) => item.heightRatio === 2)
          .map((item) => item.postId);

        // Call the function with filtered postIds
        visibleItemsWithPlayVideo(postIdsWithHeightRatio2);
      }
    
      return vItems;
    };

  const throttledUpdateVisibleItems = useThrottle(
    updateVisibleItems,
    scrollEventInterval
  );

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (onScrollList) {
      onScrollList(event)
    }
 
    const currentScrollY = event.nativeEvent.contentOffset.y;
    scrollYPosition.current = currentScrollY;

    // Calculate the position to check against the threshold
    const contentHeight = gridViewHeight;
    const scrollViewHeight = containerSize.height;
    const threshold = onEndReachedThreshold * scrollViewHeight;

    // Check if we've reached the threshold for calling onEndReached
    if (
      !onEndReachedCalled.current &&
      currentScrollY + scrollViewHeight + threshold >= contentHeight
    ) {
      onEndReachedCalled.current = true; // Marked as called to prevent subsequent calls
      onEndReached?.(); // call the onEndReached function if it exists
    }

    // Reset the flag when scrolled away from the bottom
    if (currentScrollY + scrollViewHeight + threshold * 2 < contentHeight) {
      onEndReachedCalled.current = false;
    }

    // Update visible items for virtualization
    if (virtualization) {
      throttledUpdateVisibleItems();
    }
  };

  useEffect(() => {
    if (virtualization) {
      updateVisibleItems();
    }

    // Reset onEndReachedCalled to false when data changes, allowing onEndReached to be called again
    onEndReachedCalled.current = false;
  }, [gridItems, containerSize, virtualization]);

  const getItemPositionStyle = (item: TileItem) => {
    const baseStyle = {
      position: 'absolute' as const,
      top: item.top,
      width: item.width,
      height: item.height,
    };

    return {
      ...baseStyle,
      ...(direction === 'rtl' ? { right: item.left } : { left: item.left }),
    };
  };

  return (
    <View
      style={[{ flexGrow: 1 }, style]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setContainerSize({ width, height });
      }}
    >
      <ScrollView
        ref = {scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={32}

        contentContainerStyle={{
          height: sumScrollViewHeight || '100%',
          width: containerSize.width ,
        }}
        showsVerticalScrollIndicator={showScrollIndicator}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            style={{ zIndex: 10 }}
            progressViewOffset={ !isAndroid ? 40 : 50 + 46
            }
          />
        }
      >
        {/* Render HeaderComponent if provided */}
        <View
          onLayout={({ nativeEvent }) => {
            setHeaderComponentHeight(nativeEvent.layout.height);
          }}
        >
          {renderPropComponent(HeaderComponent)}
        </View>

        <View
          style={{
            flex: 1,
          }}
        >
          {renderedItems.map((item, index) => (
            <View
              key={keyExtractor(item, index)}
              style={[getItemPositionStyle(item), itemContainerStyle]}
            >
              {renderItem({ item, index })}
            </View>
          ))}
        </View>

        {/* Render FooterComponent if provided */}
        <View
          onLayout={({ nativeEvent }) => {
            setFooterComponentHeight(nativeEvent.layout.height);
          }}
        >
          {renderPropComponent(FooterComponent)}
        </View>
      </ScrollView>
    </View>
  );
};
