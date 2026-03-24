/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  SettingIcon,
  SettingItemType,
  SettingKeyboardType,
  SettingItem,
  SettingsSection,
  SettingIconMap,
  SettingComponentProps,
  SettingSwitchProps,
  SettingButtonProps,
  SettingInputProps,
  SettingSubmenuProps,
  CustomSettingProps,
} from '../../src/types/settings';
describe('Types - settings', () => {
  describe('SettingIcon interface', () => {
    it('should create a valid SettingIcon', () => {
      const icon: SettingIcon = {
        name: 'palette',
        solid: true,
      };

      expect(icon.name).toBe('palette');
      expect(icon.solid).toBe(true);
    });

    it('should support non-solid icons', () => {
      const icon: SettingIcon = {
        name: 'globe',
        solid: false,
      };

      expect(icon.solid).toBe(false);
    });
  });

  describe('SettingItemType', () => {
    it('should accept all valid setting item types', () => {
      const types: SettingItemType[] = ['switch', 'button', 'input', 'submenu', 'custom'];

      types.forEach(type => {
        const item: SettingItem = {
          id: 'test',
          title: 'Test',
          type,
        };
        expect(item.type).toBe(type);
      });
    });
  });

  describe('SettingKeyboardType', () => {
    it('should accept all valid keyboard types', () => {
      const types: SettingKeyboardType[] = ['default', 'numeric', 'email-address'];

      types.forEach(keyboardType => {
        const item: SettingItem = {
          id: 'test',
          title: 'Test',
          type: 'input',
          keyboardType,
        };
        expect(item.keyboardType).toBe(keyboardType);
      });
    });
  });

  describe('SettingItem interface', () => {
    it('should create a minimal SettingItem', () => {
      const item: SettingItem = {
        id: 'setting-1',
        title: 'Test Setting',
        type: 'button',
      };

      expect(item.id).toBe('setting-1');
      expect(item.title).toBe('Test Setting');
      expect(item.type).toBe('button');
    });

    it('should support switch type with boolean value', () => {
      const item: SettingItem = {
        id: 'toggle',
        title: 'Enable Feature',
        type: 'switch',
        value: true,
        onValueChange: (value: boolean | string) => {
          expect(typeof value).toBe('boolean');
        },
      };

      expect(item.type).toBe('switch');
      expect(item.value).toBe(true);
      expect(item.onValueChange).toBeDefined();
    });

    it('should support input type with string value', () => {
      const item: SettingItem = {
        id: 'text-input',
        title: 'Enter Text',
        type: 'input',
        value: 'default text',
        placeholder: 'Type here...',
        keyboardType: 'email-address',
        secureTextEntry: true,
        onValueChange: (value: boolean | string) => {
          expect(typeof value).toBe('string');
        },
      };

      expect(item.type).toBe('input');
      expect(item.value).toBe('default text');
      expect(item.placeholder).toBe('Type here...');
      expect(item.keyboardType).toBe('email-address');
      expect(item.secureTextEntry).toBe(true);
    });

    it('should support button type with onPress', () => {
      const onPress = jest.fn();
      const item: SettingItem = {
        id: 'action-btn',
        title: 'Click Me',
        type: 'button',
        onPress,
      };

      expect(item.type).toBe('button');
      expect(item.onPress).toBe(onPress);
    });

    it('should support submenu with nested items', () => {
      const submenuItem: SettingItem = {
        id: 'submenu-1',
        title: 'Submenu',
        type: 'submenu',
        submenuItems: [
          {
            id: 'nested-1',
            title: 'Nested Item',
            type: 'switch',
          },
        ],
      };

      expect(submenuItem.type).toBe('submenu');
      expect(submenuItem.submenuItems).toHaveLength(1);
      expect(submenuItem.submenuItems?.[0].id).toBe('nested-1');
    });

    it('should support description and descriptionNode', () => {
      const item: SettingItem = {
        id: 'with-desc',
        title: 'Setting',
        type: 'button',
        description: 'Plain text description',
        descriptionNode: null, // ReactNode
      };

      expect(item.description).toBe('Plain text description');
      expect(item.descriptionNode).toBeNull();
    });

    it('should support error state', () => {
      const item: SettingItem = {
        id: 'error-setting',
        title: 'Invalid Setting',
        type: 'input',
        error: 'Invalid value',
      };

      expect(item.error).toBe('Invalid value');
    });

    it('should support disabled state', () => {
      const item: SettingItem = {
        id: 'disabled-setting',
        title: 'Disabled',
        type: 'button',
        disabled: true,
      };

      expect(item.disabled).toBe(true);
    });

    it('should support icon as string', () => {
      const item: SettingItem = {
        id: 'with-icon',
        title: 'Setting',
        type: 'button',
        icon: 'palette',
      };

      expect(item.icon).toBe('palette');
    });

    it('should support icon as SettingIcon object', () => {
      const item: SettingItem = {
        id: 'with-icon-obj',
        title: 'Setting',
        type: 'button',
        icon: { name: 'palette', solid: true },
      };

      expect(typeof item.icon).toBe('object');
      expect((item.icon as SettingIcon).name).toBe('palette');
    });

    it('should support search keywords', () => {
      const item: SettingItem = {
        id: 'searchable',
        title: 'Setting',
        type: 'button',
        searchKeywords: ['keyword1', 'keyword2', 'theme'],
      };

      expect(item.searchKeywords).toEqual(['keyword1', 'keyword2', 'theme']);
    });
  });

  describe('SettingsSection interface', () => {
    it('should create a valid SettingsSection', () => {
      const section: SettingsSection = {
        id: 'section-1',
        title: 'General',
        data: [
          {
            id: 'setting-1',
            title: 'Setting 1',
            type: 'switch',
          },
          {
            id: 'setting-2',
            title: 'Setting 2',
            type: 'button',
          },
        ],
      };

      expect(section.id).toBe('section-1');
      expect(section.title).toBe('General');
      expect(section.data).toHaveLength(2);
    });

    it('should support empty data array', () => {
      const section: SettingsSection = {
        id: 'empty-section',
        title: 'Empty',
        data: [],
      };

      expect(section.data).toEqual([]);
    });
  });

  describe('SettingIconMap type', () => {
    it('should work as a record of icons', () => {
      const iconMap: SettingIconMap = {
        'display-theme': { name: 'palette', solid: true },
        'app-language': undefined,
      };

      expect(iconMap['display-theme']).toEqual({ name: 'palette', solid: true });
      expect(iconMap['app-language']).toBeUndefined();
    });
  });

  describe('SettingComponentProps interface', () => {
    it('should have required properties', () => {
      const props: SettingComponentProps = {
        item: {
          id: 'test',
          title: 'Test',
          type: 'switch',
        },
        icon: { name: 'test', solid: false },
        colors: {
          text: '#000000',
          textSecondary: '#666666',
          primary: '#2196F3',
          surface: '#FFFFFF',
          border: '#E0E0E0',
          background: '#FFFFFF',
        },
        styles: {
          settingItem: {},
          settingContent: {},
          settingTitleRow: {},
          settingTitle: {},
          settingDescription: {},
          disabledItem: {},
          disabledText: {},
          chevron: {},
        },
      };

      expect(props.item).toBeDefined();
      expect(props.colors).toBeDefined();
      expect(props.styles).toBeDefined();
    });

    it('should have optional input styles', () => {
      const props: SettingComponentProps = {
        item: {
          id: 'test',
          title: 'Test',
          type: 'input',
        },
        colors: {
          text: '#000000',
          textSecondary: '#666666',
          primary: '#2196F3',
          surface: '#FFFFFF',
          border: '#E0E0E0',
          background: '#FFFFFF',
        },
        styles: {
          settingItem: {},
          settingContent: {},
          settingTitleRow: {},
          settingTitle: {},
          settingDescription: {},
          disabledItem: {},
          disabledText: {},
          chevron: {},
          input: {},
          disabledInput: {},
          watchAdButton: {},
          watchAdButtonDisabled: {},
          watchAdButtonText: {},
        },
      };

      expect(props.styles.input).toBeDefined();
      expect(props.styles.disabledInput).toBeDefined();
    });
  });

  it('should support the full colors and styles contract used by settings components', () => {
    const props: SettingComponentProps = {
      item: {
        id: 'full-contract',
        title: 'Full Contract',
        type: 'custom',
      },
      colors: {
        text: '#111111',
        textSecondary: '#666666',
        primary: '#0088ff',
        surface: '#ffffff',
        border: '#dddddd',
        background: '#f5f5f5',
      },
      styles: {
        settingItem: { padding: 4 },
        settingContent: { flex: 1 },
        settingTitleRow: { flexDirection: 'row' },
        settingTitle: { fontWeight: '600' },
        settingDescription: { color: '#666' },
        disabledItem: { opacity: 0.5 },
        disabledText: { color: '#999' },
        chevron: { marginLeft: 8 },
        input: { borderWidth: 1 },
        disabledInput: { opacity: 0.5 },
        watchAdButton: { padding: 8 },
        watchAdButtonDisabled: { opacity: 0.4 },
        watchAdButtonText: { fontSize: 12 },
      },
    };

    expect(props.styles.watchAdButtonText).toBeDefined();
    expect(props.colors.background).toBe('#f5f5f5');
  });

  describe('SettingSwitchProps interface', () => {
    it('should extend SettingComponentProps with onValueChange', () => {
      const onValueChange = jest.fn();
      const props: SettingSwitchProps = {
        item: {
          id: 'switch-test',
          title: 'Switch',
          type: 'switch',
        },
        colors: {
          text: '#000000',
          textSecondary: '#666666',
          primary: '#2196F3',
          surface: '#FFFFFF',
          border: '#E0E0E0',
          background: '#FFFFFF',
        },
        styles: {
          settingItem: {},
          settingContent: {},
          settingTitleRow: {},
          settingTitle: {},
          settingDescription: {},
          disabledItem: {},
          disabledText: {},
          chevron: {},
        },
        onValueChange,
      };

      expect(props.onValueChange).toBe(onValueChange);
      expect(typeof props.onValueChange).toBe('function');
    });
  });

  describe('SettingButtonProps interface', () => {
    it('should extend SettingComponentProps with onPress', () => {
      const onPress = jest.fn();
      const props: SettingButtonProps = {
        item: {
          id: 'btn-test',
          title: 'Button',
          type: 'button',
        },
        colors: {
          text: '#000000',
          textSecondary: '#666666',
          primary: '#2196F3',
          surface: '#FFFFFF',
          border: '#E0E0E0',
          background: '#FFFFFF',
        },
        styles: {
          settingItem: {},
          settingContent: {},
          settingTitleRow: {},
          settingTitle: {},
          settingDescription: {},
          disabledItem: {},
          disabledText: {},
          chevron: {},
        },
        onPress,
      };

      expect(props.onPress).toBe(onPress);
      expect(typeof props.onPress).toBe('function');
    });
  });

  describe('SettingInputProps interface', () => {
    it('should extend SettingComponentProps with onValueChange and optional onPress', () => {
      const onValueChange = jest.fn();
      const onPress = jest.fn();
      const props: SettingInputProps = {
        item: {
          id: 'input-test',
          title: 'Input',
          type: 'input',
        },
        colors: {
          text: '#000000',
          textSecondary: '#666666',
          primary: '#2196F3',
          surface: '#FFFFFF',
          border: '#E0E0E0',
          background: '#FFFFFF',
        },
        styles: {
          settingItem: {},
          settingContent: {},
          settingTitleRow: {},
          settingTitle: {},
          settingDescription: {},
          disabledItem: {},
          disabledText: {},
          chevron: {},
        },
        onValueChange,
        onPress,
      };

      expect(props.onValueChange).toBe(onValueChange);
      expect(props.onPress).toBe(onPress);
    });
  });

  describe('SettingSubmenuProps interface', () => {
    it('should extend SettingComponentProps with onPress', () => {
      const onPress = jest.fn();
      const props: SettingSubmenuProps = {
        item: {
          id: 'submenu-test',
          title: 'Submenu',
          type: 'submenu',
        },
        colors: {
          text: '#000000',
          textSecondary: '#666666',
          primary: '#2196F3',
          surface: '#FFFFFF',
          border: '#E0E0E0',
          background: '#FFFFFF',
        },
        styles: {
          settingItem: {},
          settingContent: {},
          settingTitleRow: {},
          settingTitle: {},
          settingDescription: {},
          disabledItem: {},
          disabledText: {},
          chevron: {},
        },
        onPress,
      };

      expect(props.onPress).toBe(onPress);
    });
  });

  describe('CustomSettingProps interface', () => {
    it('should allow custom properties', () => {
      const props: CustomSettingProps = {
        item: {
          id: 'custom-test',
          title: 'Custom',
          type: 'custom',
        },
        colors: {
          text: '#000000',
          textSecondary: '#666666',
          primary: '#2196F3',
          surface: '#FFFFFF',
          border: '#E0E0E0',
          background: '#FFFFFF',
        },
        styles: {
          settingItem: {},
          settingContent: {},
          settingTitleRow: {},
          settingTitle: {},
          settingDescription: {},
          disabledItem: {},
          disabledText: {},
          chevron: {},
        },
        customProp1: 'value1',
        customProp2: 123,
        onCustomAction: jest.fn(),
      };

      expect(props.customProp1).toBe('value1');
      expect(props.customProp2).toBe(123);
      expect(typeof props.onCustomAction).toBe('function');
    });
  });
});
