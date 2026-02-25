import PropTypes from "prop-types";

const DEFAULT_ICON_SIZE = 16;
const DEFAULT_ICON_STROKE_WIDTH = 2;

const normalizeLabel = (label) => {
  if (typeof label !== "string") {
    return "Icon";
  }

  const trimmed = label.trim();
  return trimmed || "Icon";
};

const LucideIcon = ({
  icon: IconComponent,
  decorative = true,
  label = "",
  size = DEFAULT_ICON_SIZE,
  strokeWidth = DEFAULT_ICON_STROKE_WIDTH,
  className = "",
  ...rest
}) => {
  if (typeof IconComponent !== "function") {
    return null;
  }

  if (decorative) {
    return (
      <IconComponent
        aria-hidden="true"
        className={className}
        focusable="false"
        size={size}
        strokeWidth={strokeWidth}
        {...rest}
      />
    );
  }

  return (
    <IconComponent
      aria-label={normalizeLabel(label)}
      className={className}
      role="img"
      size={size}
      strokeWidth={strokeWidth}
      {...rest}
    />
  );
};

LucideIcon.propTypes = {
  className: PropTypes.string,
  decorative: PropTypes.bool,
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string,
  size: PropTypes.number,
  strokeWidth: PropTypes.number,
};

export default LucideIcon;
