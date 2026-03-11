import React from "react";
import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { MotionPressable } from "@/components/ui/motion-pressable";

describe("MotionPressable", () => {
  it("renders when callers pass nested style arrays with conditional falsy entries", () => {
    const focused = false;
    const highlighted = true;

    render(
      <MotionPressable
        accessibilityLabel="Open Products tab"
        accessibilityRole="tab"
        accessibilityState={{ selected: true }}
        onPress={() => {}}
        style={[
          styles.button,
          [
            focused ? styles.focusedButton : null,
            highlighted ? styles.highlightedButton : false,
          ],
        ]}
        tone="ghost"
      >
        tab
      </MotionPressable>,
    );

    const pressable = screen.getByLabelText("Open Products tab");
    const resolvedStyle = StyleSheet.flatten(pressable.props.style);

    expect(pressable).toBeTruthy();
    expect(pressable.props.accessibilityState).toMatchObject({
      disabled: false,
      selected: true,
    });
    expect(resolvedStyle).toMatchObject({
      borderColor: "#0057ff",
      minHeight: 58,
    });
    expect(resolvedStyle.transform).toBeUndefined();
  });
});

const styles = StyleSheet.create({
  button: {
    minHeight: 58,
  },
  focusedButton: {
    opacity: 0.6,
  },
  highlightedButton: {
    borderColor: "#0057ff",
  },
});
